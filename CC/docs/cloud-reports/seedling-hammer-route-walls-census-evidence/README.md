# ROUTE-WALLS-CENSUS evidence

- `w0/` — the live page sweep (`probe-seedling-divergence-sweep.mjs --mode=inv --producer=solver --page-legs=1
  --page=seedling_bot_ap_p4g --capture-requests`, :8000, main `6473024aa8`'s defaults):
  - `sweep.tsv` — the 40 legs with `level` or `target_level` in {53, 54, 89, 90, 91, 92} (`ids.txt`): end, plans,
    ticks, roomHits, seam, the page's failure text.
  - `sweep-cross-room.tsv` — three hand-built legs (`cross-room-legs.jsonl.gz`, ids 9001–9003) for the walk's own
    route, which the leg list lacks: L53 crossed from `r2c2` (the L51 / L48 doors) to the `r14c9` exit, and L92 crossed
    from the L87 door to the `r4c2` exit. Same shape as the list's link legs (`arrive.entry: 'link'`), same inventory as
    the leg they copy.
  - `carry-check.txt` — `--carry-route-flags` (DOOR-CARRY branch) changes leg 0 only, no wall leg.
  - `sweep-head.txt` — the box lock and run lines.
- `w1/` — node replays of every failing captured request (`tools/chain.mjs`, L40-CENSUS's instrument; cap 40960):
  - `chains-D0.txt` — each chain: rows stamped with the work unit, the work by solver frame, the end.
  - `arms-table.tsv.gz` — every request × arm: main's OFF switches (CSH OPP PEE CPAIR OPP+CSH ALL) on main, the five
    wave-6 switches (SHSM CCUT DVB CTC KT, CSH+SHSM, OPP+CSH+SHSM, W6 = all) on `hammer-harvest-wave6` `a874dc163f`, and
    the scratch drill what-ifs; digest and "same as main D0".
  - `whatif-drill.patch` — the scratch what-if (never on a tracked path; applied to a throwaway worktree of main):
    WI-A the exit timed pass allowed with a drill-killing weapon held; WI-B `execDrillKillsFirst` before a reach-exit;
    WI-C the wake test's walk planned with the door allowed (`allowTeleporter` as the planner's ARGUMENT) and the
    drill's own volume lifted; plus debug lines (`CENSUS_DBG`).
  - `whatif-drill-page.txt` — WI-A+C on the game page: 718 done, 190 t, 0 hits, 0 divergences; 719 the DRILL D2 refusal.
  - `map-l91-719.txt`, `map-l53-9001.txt` — the arrival rooms: lattice, volumes, the smallest removal set that admits.
- `w2/wall-map.tsv` — the map.
- `tools/` — `chain.mjs`, `arms.sh` (+ `ROOT`, the wave-6 names), `volumes.mjs` (every volume kind, not only chasers),
  `probe-walk.mjs`, `chainrows.cjs`, `w0table.mjs`, `sum.cjs`, `keyline.mjs`, `map.mjs` (PIT-WEST's). Scratch; they
  decide nothing. The captured requests (21 MB) are not committed; re-capture with the W0 command plus
  `--ids=$(cat w0/ids.txt) --capture-requests=<out>` (and `--legs=<cross-room legs>` for 9001–9003).
