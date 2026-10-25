# MISCRES D2 — leg 785 (`level_107 <- in_L108_0_32 -> exit:out_teleporter_0_48`): where the work goes

Captured at base `e8d85de8d1` by a local sweep (p4g, inv, solver, port 9730):
`probe-seedling-divergence-sweep.mjs --legs=<derived at the base> --keys="level_107 <- in_L108_0_32 -> exit:out_teleporter_0_48"
--capture-requests=cap785.jsonl` → `sweep785.jsonl` (failed: "ran out of 640, then 2560 work units", the first request
captured at seam time 5594, the held retry at 5622). `gunzip -k cap785.jsonl.gz` before replaying.

| file | what |
|---|---|
| `sites.mjs <cap.jsonl> <i> [nobudget\|huge] [passes] [--at=<seam>]` | a per-site census of one captured request (a counting progress hook; `huge` = budget 1e9, so `work` is still counted) |
| `seam785-i0.jsonl`, `seam785-i1.jsonl` | `replay-seedling-solve-request.mjs --seam-time-sweep=-30..30` on request 0 (640) and request 1 (2560) |
| `refusal-5594.txt` | the room's own refusal, unbudgeted |
| `l107.mjs`, `beamperiod.mjs` | L107's roster; the beam towers' measured cycle |

Numbers (all deterministic per request):
- request 0 (640): 61/61 clocks 5564..5624 → budget-out, dashless 641 units (632 at `phase-dodge`), full 1 unit (trips at `walk`).
- request 1 (2560): **12/61 clocks (5600..5611) SOLVE**, dashless 731 units (712 at `phase-dodge`), 387..390 t, verbs
  dodge + walk; 49/61 → budget-out at 2562 (`phase-dodge`).
- unbudgeted: solving clock (5605) 731 dashless + 817 full (window) = 1,548; refusing clocks (5594, 5640) **7,656 per pass**
  (7,120 = ten full 89×8 stall scans at `phase-dodge`, 529 `detour`), both passes REFUSE: the combat ladder exhausted on
  `beamtower@208,120`'s beam (avoid / dodge / bent / time / bait / kill / forced-hit all refused).
- the beam towers (`rate 2`, `speed 0.5`) cycle in **52 ticks**, inside the stall window 1..89: the stall bound is not
  what refuses (hypothesis measured and refuted).
