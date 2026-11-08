# KEYLOCK-TURRET M — the designs measured (scratch arms of the switch while it was built; node, `tools/chain.mjs`)

| design | 395 (tag 12) | 412 (tag 12) | verdict |
|---|---|---|---|
| OFF | REFUSED 20 u, "0 cell(s)" | REFUSED 20 u | — |
| brave: the key line's disc exempt, no kill (a timing window on the key line) | REFUSED 144 u: the stance walk's ladder EXHAUSTED at (471.6,441.1) on `enemy:iceturret@472,400`'s live body; AVOID "different connected components" — the turret's 32 px body fills the column to the pocket | not run | rejected: the live body cuts the only corridor; on the gadget the stand is also hit (`w0/stand-keyline.txt`: t54 < the t83 open) |
| kill first by ICEST's `killIceTurretOnWalk` (staging asked in the world as it is) | REFUSED 20 u at t0: "no plannable staging point outside the range" on every side (the south door is still shut at t0) | — | rejected alone |
| ICEST's kill + a pre-walk to the corridor's last point outside the range | REFUSED 12809 u: 490 forks, every approach hit by a blast (its delay is spent OUTSIDE the range, where `IceTurret.update` re-arms `shootTimer`: VOLLEY-APPROACH's finding) | — | rejected |
| **kill first by APPROACH's search (`approachKillForCorpse`: the loop's walk to a staging point past the range, then sides × routes × in-range waits on forks)** | **SOLVED 718 t, 2534 u**, fresh replay hits [] deaths 0; kill `right` side, wait 29, 276 forks | **SOLVED 748 t, 323 u**; kill `up` via (466,445), wait 25, 27 forks | **chosen** |

Door shut (no tag 12), the chosen design: 395 REFUSED 1405 u, 412 REFUSED 284 u, both by name: *"no approach to
iceturret@472,400 from the staging point (488,579) is hitless — 12 fork(s), {"no-plan":12}"* (APPROACH's own answer
behind the latched `wandlock@480,560`, as on 860).

`node-arms.jsonl` holds the rows (`arm`: `T12-*` = `--persist=40:12` on the defaults capture; `P12-*` = the page's own
tag-12 capture; `D0-*` = no tag 12; `-KT` the ICEST kill, `-KT2` + the pre-walk, `-KT3`/`P12-KT` the chosen one,
`-BRAVE` the brave arm).
