# rules-l25-wand-witness evidence

Slice `rules-l25-wand-witness` (REPORT ONLY). The report is `../cloud-report-rules-l25-wand-witness.md`.

- `tools/witness2.mjs`: plays a key-span spec on the WASM game (`seedling_bot_ap_p4g`), one fresh page per spec, with the
  staging of `scripts/procgen/probe-seedling-wallflyer-nohit.mjs` (`caseTape`). A page-side sampler records `botStatus` +
  `botMobiles` once per game tick, so every hit, flyer launch, WandShot, Bob and the pushable block is attributable.
  `--arm=` re-stages the same keys with another arm, `--drop=primary` removes the presses (a control).
- `tools/segtape.mjs`: compiles a hand-authored segment list (`segs/*.json`) into a spec (`tapes/*.json`). The model
  refuses a WandShot in a wallflyer room (`MODEL_REFUSES.wand`), so every Wand tape here is HAND-AUTHORED and tuned on
  the game's own trace.
- `tools/run.sh <name>`: segtape + witness2. `tools/show.mjs <trace>`: prints a trace.
- `plan-l25-26-22-wand.json`: the YES line and its control in the plans file's shape (`plans` + `controls`).
- `tapes/l25-26-22-wand.json`: the YES tape. `tapes/l25-26-22-sword.replay.json`: the table's Sword witness, verbatim.
- `runs/`: one `.log` and one `.trace.json` per attempt. `runs/from-derivation/`: the derivation slice's three L25 tapes
  replayed on this base.
- `from-derivation/`: copies of the derivation slice's tools, tapes and logs (branch
  `claude/wallflyer-no-hit-derivation-2y9dio` @43aa6dcd67), unchanged.
