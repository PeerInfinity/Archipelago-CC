# L40-CENSUS evidence

- `w0/` — the live page sweep of all 64 L40 legs at main's defaults (`2342e256`): `sweep-l40.tsv` (one row per leg: end,
  plans, ticks, roomHits, seam, arrival clock, the page's failure text), `l40ids.txt` (the ids: `level === 40 ||
  target_level === 40` in `seedling-divergence-legs.mjs`'s list), `sweep-head.txt` (the box lock and run lines).
- `w1/` — every failing request replayed in node, the anytime deadline lifted to 40960 work units (`tools/chain.mjs`):
  - `chains-D0.txt` — the chain per failing request at the defaults: each trace row (verb, body, game tick) stamped with
    the WORK UNIT it landed at, the work by solver frame, and the end.
  - `arms-table.txt.gz` — every request × arm (D0, each OFF switch alone, ALL nine, ALL-minus-one, ALL+CHS/OFA, OPP+CSH):
    work, wall time, digest, and the wall it ended on (or SOLVED with the fresh-run hits/deaths).
  - `whatif-persist.txt` — the same requests with L40 persistence rows staged (`--persist`: 0 the tree burnt, 12 the south
    door `wandlock@480,560` cleared, 13 the chest opened, 16 `spinner@880,848` killed).
  - `chain-rows.jsonl.gz` — the rows behind both tables (compacted: non-walk rows, heads cut to 1500 chars).
  - `keyline-395.txt` — the cells around `bosslock@480,352` on the 16 px lattice: every cell whose pinned box touches the
    key line is a planner obstacle as `proximity-hazard` of the live `iceturret@472,400`.
  - `leg376.txt` — leg 376 on five page runs (W0's + four repeats): seam, plans, hits, the divergence, and the captured
    requests' work; run 3's request replayed uncapped.
  - `staged-hunt-cost.txt` — 394 and 411 under OPP+CSH with the per-unit frame attribution: the staged hunt's asks.
- `tools/` — the instruments (scratch; they decide nothing): `chain.mjs` (the uncapped replay + attribution + what-if
  persistence + the 30(c) fresh-run check), `arms.sh` (the arms runner), `sum.cjs` (the table), `w0table.mjs`,
  `keyline.mjs`. The captured requests (37 MB, `--capture-requests` of the W0 sweep) are not committed; re-capture with
  `probe-seedling-divergence-sweep.mjs --legs=<legs> --mode=inv --producer=solver --page-legs=1
  --page=seedling_bot_ap_p4g --ids=$(cat w0/l40ids.txt) --capture-requests=<out>` against a :8000 dev server.
