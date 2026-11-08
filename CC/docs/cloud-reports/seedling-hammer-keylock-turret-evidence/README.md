# KEYLOCK-TURRET evidence

- `w0/` — the wall reproduced, and the hazard measured.
  - `page-defaults-rows.jsonl` / `page-defaults.log`: the live page sweep of legs 395/412 at main's defaults
    (`probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --page-legs=1 --page=seedling_bot_ap_p4g
    --ids=395,412 --capture-requests=…`, :8000, this tree at `97739720`).
  - `page-tag12-rows.jsonl` / `page-tag12.log`: the same with `--stage-flags=<key>=>40:12` on both legs (⚖ "Carry the
    door for now": the button room's flag 12 written into the game before the jump).
  - `node-chain.jsonl`: the captured defaults requests replayed in node (`tools/chain.mjs`, the census's tool + the
    switch's counters), at the defaults and with `--persist=40:12`.
  - `stagings.jsonl`: the four captured requests' staging and goal (the level records cut: the committed atlas answers
    the same, see the report).
  - `map-395-tag12.txt`: `tools/map.mjs` — the planner's view around the lock ('#' solid, 'h' only a turret's disc,
    'T' the turret's live box, 'L' a lock or a pushable block, '.' free).
  - `door-opens-tag12.txt`: `tools/door.mjs` — the south door `wandlock@480,560` (persistence tag 11) fades open at
    ~t100 with tag 12 held cleared; never without it.
  - `stand-keyline.txt`: `tools/stand.mjs` — the model's answer to "does standing on the key line with the turret alive
    get the player hit?" (a generated room; then the same room with no turret).
- `m/`: `design.md` (the design table), `node-arms.jsonl` (every arm's row), `radius-atlas.txt`
  (`tools/radius-atlas.mjs`: every level with an ice turret, each bosslock's key-line distance to its disc).
- `game/`: the page sweep with the switch ON (`--solver-env=SEEDLING_KEYLOCK_TURRET=1`) and tag 12 staged: the game
  witness of the plans the model certified.
- `mutants/`: `tools/mutants.py`'s runs (each mutant, the fast rows' verdicts).
- `gates/`: the D battery's outputs.
- `tools/`: scratch instruments; none is loaded by the app. `gadget.mjs` solves the generated room under the env's
  switches. The captured requests (~3.7 MB) are not committed: re-capture with the commands above.
