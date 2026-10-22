# seedling-fidelity-igneous — evidence

- `w0/` — the base: `identity.txt` (the identity block at `934f99422b`), `campaign.txt` (the r9-campaign `--check`
  re-run alone: the base's own `r9-solve-32` trace drift).
- `after/` — `identity-off.txt` / `identity-on.txt` (the block at the code head, OFF and `SEEDLING_IGNEOUS_LAVA=1`; both
  equal W0), `vitest-before-to-off.diff` and `vitest-off-to-on.diff` (the bounded run's sorted `status\tfile > name`
  rows, diffed).
- `d1/` — the probe's printed comparison for each witness tape (game vs the OFF model), and for survey 195's ON walk.
- `survey/` — the 15 type-31 steps: `steps-off.json`, `steps-on-model-only.json` (D2 without D3), `steps-on.json`.
- `d4/` — the 49 type-31 sweep legs in node, OFF and ON (`legs-off.jsonl`, `legs-on.jsonl`), and the dispatch inputs
  (`sweep-keys.txt`, `contact-fidelity-A-B.txt`).
- `drivers/` — `mktape.py` (the witness tapes), `sim.mjs` / `cmp.mjs` (model vs a probe's stream), `inv-leg.mjs` /
  `inv-leg-replay.mjs` (a sweep leg in node, and its plan replayed OFF and ON).
- `bounded-files.txt` — the bounded vitest set.
