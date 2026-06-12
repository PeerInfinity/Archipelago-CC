# Real-DJ renderer (`bounceDjRealPanel`)

Renders dj-profile bounce regions inside the **real Doodle Jump SWF** via
SWFRecomp-CC's injected-ActionScript level loader, instead of the JS canvas
renderer (`../game/`). Same `__swfBridge` contract, same injected host
bridge (`flashSubstrate/bridge.js`) — a different page.

Select it with the `moduleSettings.bounceDemo.renderer` setting
(`"dj"`; default `"js"` keeps the JS renderer). Takes effect on the next
bounce region entry. Non-dj-profile payloads are refused loudly by the
page (this renderer IS the dj physics).

## No SWF in this repository

The original Doodle Jump SWF is the user's own copy. `index.html` acquires
it (fetch `Doodle_Jump.swf` here → IndexedDB cache → drag-and-drop onto the
stage) and splices `loader_bytecode.bin` into it **in the browser**
(`swfPatch.js`), including the 600px header-RECT widening. Only the loader
bytecode is committed — it is compiled from SWFRecomp-CC's `Loader.as` and
contains no game content.

## File provenance (keep in sync with SWFRecomp-CC)

| File | Source | Sync |
|---|---|---|
| `dj_swf_bridge.js` | `SWFRecomp-CC/ruffle-tests/tests/swfs/_swfbridge/livetest/dj_loader/dj_swf_bridge.js` | verbatim copy; re-copy when their loader/encoder changes |
| `loader_bytecode.bin` | same dir, built by their `build_loader.sh` (MTASC-compiled `Loader.as`) | re-copy after each loader increment |
| `swfPatch.js` | PROVISIONAL port of their `tools/divergence/inject_tracer.py` (CWS + SWF≥6 subset) | replace with the SWFRecomp-CC-owned browser injector when it ships (handoff addendum deliverable); byte-identity pinned by `scripts/procgen/verify-dj-swf-patch.mjs` |
| `runtime/` | SWFRecomp browser-WASM build artifacts (gitignored) | see `runtime/README.md` |

Spec + increment coordination:
`NewDocs/plans/procedural-generation/dj-loader-integration-spec.md` and the
addendum next to it.
