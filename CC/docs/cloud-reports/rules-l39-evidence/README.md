# rules-l39 evidence

Game witnesses for RULES slice `rules-l39`: L39's pulser and rope run, and L43's doorway after the Wand. Every tape ran on a
FRESH page of `seedling_bot_ap_p4g` (headless logic-only), on the delivered set `seedling-vanilla-record-5aeefc3c`.
`l43-control` ran on the pre-L43 set `seedling-vanilla-record-f5bdb07d`.

Producer: `node scripts/procgen/probe-seedling-l39-pulser.mjs --out=CC/docs/cloud-reports/rules-l39-evidence`
(the log is `probe-l39-pulser.log`; one `l39-pulser-<tape>.json` per tape).

| tape | staged | items | game | rule it witnesses |
|---|---|---|---|---|
| pulse-armed | {39,9} | none | 2 hits, knocked about 78 px east | the cut arms `pulser@64,96` (tset 6; `Pulser.as:54-84`) |
| pulse-control | — | none | 0 hits, still | an uncut rope leaves the pulser idle |
| span-blocked | — | none | stops at y 402.05 (≥ 400) | the uncut rope's whole run is solid (`RopeStart.as:26`) |
| span-cut | {39,9} | none | passes, y 260 | after the cut only the pulley stays solid (`:40-47`) |
| span-slash | — | Sword | clears {39,9}, passes (y 354.5) | the run is cut from the corridor |
| chain-armed | {39,9} | none | stops at y 82.55, under wandlock@144,64 | an armed pulser opens no chain lock: no fire block starts within its reach |
| l43-open | {43,1} {43,2} {43,3} | none | south through (11,24), stairs → L40 at t88 | `l43-fallrock-removed`: the doorway stays open after the Wand |
| l43-control | the same, on the pre-L43 set | none | stops at y 380.95 | the control: the fallen doorway rock seals it |

Not witnessed: the Fire hand order that holds all three chain buttons at once. It needs about five Fire pushes,
including one from the (10,9) stance; that is a long hand-built tape. `Has(Fire)` stands on the AS3 trace: every holder
is a fire block, and a fire block moves only on a Fire or Pulse hit (`PushableBlockFire.as:280`).
