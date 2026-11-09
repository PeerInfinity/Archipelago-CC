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
- `m/` — the design measurements and the game witness:
  - `ablations.jsonl` — node (`chain.mjs`, cap 40960) over the captured requests: the prototype (`L53_X`, scratch) and its
    ablations (NOTOL: the rewind at tolerance 0; NOGRACE: no dying grace), and this branch's switch OFF/ON.
  - `arms-l95-switches.jsonl` — L95-PUNCHER's answer (`CHASER_STAGED_HUNT` + `CLEARTAG_STAND`, both on main) with and
    without this switch.
  - `page-sweep-on.tsv` — the page sweep with `--solver-env=SEEDLING_KILLLOCK_CHASER_REWIND=1`.
  - `contact-capture-900{1,2}-on.json.gz` — `probe-seedling-contact-divergence.mjs --capture` (a scratch copy that adds
    `?seedlingSolverEnv=` to the page URL: `scratch-rock-lag-and-probe-env.patch`), ON, 9001 and 9002 each on its own
    page: the request, the plan, every sampled game tick with the player and every body. THE FIDELITY WITNESS.
  - `body-diff-*.txt` (`tools/body-diff.mjs`), `rocks-broken-model.txt` (`tools/rocks-broken.mjs`) — the first body
    divergence and the model's rock rows.
  - `rock-lag-whatif.txt` — the scratch what-if (`L53_ROCK_LAG=n`: `brokenRockIdsNow` read n updates later, in a
    scratch worktree only): at n = 2 both captures reproduce, every body and the player, worst |Δ| 0.000 px.
- `i/` — the switch's rows: `mutants.txt` (`tools/mutants.py`, a scratch worktree), `fixture-cut.txt` (cut = uncut).
- `radius/` — the ON radius: `ids.txt` (the 234 legs in a jellyfish / puncher / kill-lock level), `page-sweep-off.tsv`
  (the page sweep OFF at this head with request capture), `radius-off-on.jsonl.gz` (`tools/radius.mjs`: each captured
  request solved as the worker solves it, OFF and ON, each plan re-driven on a fresh run; `moved` = digest differs).
- `d/` — the gate outputs (`bounded-*`, `slow-hammer`, `train`, `producer-*`, `identity`, `surface`, `constants`,
  `check-ref`, `docs-index`, `tick0`, `wasm-ship`, `env-strategy`).
