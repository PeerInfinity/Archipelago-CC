# L53-KILLLOCK evidence

- `tools/` — scratch instruments (decide nothing): `chain.mjs` (ROUTE-WALLS-CENSUS's / L40-CENSUS's, unchanged: one
  captured request, every anytime pass on one work clock, the deadline lifted to `--cap`, a 30(c) fresh-run check of a
  solved plan), `room.mjs` (the arrival room's tile types, chasers, activators).
- `w0/` — the reproduction at main `0d575b78ea`'s defaults:
  - `legs-9001-9002-482.jsonl` — the legs fed to the page: the census's hand-built 9001 (L51 door) and 9002 (L48 door),
    copied from `…route-walls-census-evidence/w0/cross-room-legs.jsonl.gz`, and 482 from this head's
    `seedling-divergence-legs.mjs`.
  - `page-sweep-d0.tsv` — `probe-seedling-divergence-sweep.mjs --legs=<that file> --mode=inv --producer=solver
    --page-legs=1 --page=seedling_bot_ap_p4g --capture-requests=…` on :8000 (`serve-nocache.py`).
  - `node-chains-d0.txt` — `chain.mjs --cap=40960 --frames=1` over every captured request.
  - `room-l53-9001.txt` — the room at the 9001 arrival (W water, v snow, w ice, # solid).
  - `dwell-trace-9001-d0.txt.gz`, `derive-trace-9001-d0.txt`, `puncher-pin-9001.txt` — debug lines from a scratch
    worktree (`scratch-debug-and-prototype.patch`; never on a tracked path): each dwell tick (player, body, hits,
    i-frame, keys), each derivation's refusal classes, the camera, and the puncher's blocked sweep steps.
- The captured requests (~2 MB) are not committed; re-capture with the `page-sweep-d0` command. The committed fixture is
  `frontend/modules/seedlingDemo/fixtures/hammer-l53-killlock/`.
