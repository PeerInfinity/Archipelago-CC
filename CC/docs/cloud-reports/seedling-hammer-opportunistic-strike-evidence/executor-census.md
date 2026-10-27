# OPP W0 — the executor census (`solverBot.js` at `12b0c124`, and the `botDriverV2.js` runners it calls)

Method: every `.advance(` site in `solverBot.js` (83) and `botDriverV2.js` mapped to its enclosing function
(`census.mjs`, a reading aid), then each function READ for how its held set is chosen. "Policy" = it calls
`strike.decide` on its live ticks; "how" = where the policy comes from; "preview/drive" = whether the walk it executes
was certified by a preview carrying the same policy.

| executor (advance site) | consults a strike policy? | how it gets one | preview and drive agree on it? |
|---|---|---|---|
| walks: `walkTo` → `previewWalk` (certify) → `botDriverV2.drive` → `driveStepHeld` (solveSegmentUnder's walk sites, the TIME rung's stall walks, DETOUR, the BAIT/AVOID corridors, `execKillByChaser`'s approach, the L39 shaft's walk) | **yes** | `strikePolicyFor(run, {dashMode[, dashPlan, iframeLapse]})` at the call site, a fresh one for the preview and for the drive | **yes** (⚖ 30(c); the existing preview/drive equality rows) |
| axis-aligned walks (`axisAligned: true`) | no (`strike: null` on both sides, on purpose) | — | yes (both strike-free) |
| `guardedChaserDwell` (the chaser kill's dwell) | **yes** | the walk's `strikePolicyFor`, handed down | no preview (a dwell is not previewed) |
| `execBreak` idle ticks (`ctx.idleStrike`) | **yes** | `execWeigh`'s `strikePolicyFor` | no preview |
| `runDwell` (the weigh fade, the L39 fade, F1b's lock fades) | **yes** when handed `strike` | `armed(...)` from `strikePolicyFor` | no preview |
| `runShove` settle ticks | **yes** when handed `strike` | `ctx.idleStrike` | no preview |
| **`execKillByPressOnce` — the press kill: strike walk, refuge walk, the stand at the strike cell (the dwell), the refuge wait** | **NO** | — | its previews (`deriveStrike`'s `walkTo`, `deriveRefuge`'s candidates) carry no policy; its drive (`chooseHeld` → `stepToward` → `safeStep`) asks none — consistent, and strike-free |
| `execKillByPressOnce`'s fade tail (bodies gone) | no | — | — (nothing to strike: the counted bodies are dead) |
| `runHold` (botDriverV2, holds on a presser) | no | — | — (it pushes `NO_HELD` and refuses a tick that MOVED: an aim tick is a move) |
| `runPace` / `planPacedWait` (`MOVING_WAIT`) | no | — | — |
| `runLatchedWait`, `runWait`, `runWaitShut` | no (`runWait` reads none) | — | — |
| `runCollect` / `runChest` / `execCollect`'s keep-grid approach | no | — | — |
| `runBait`, `execBait` forks | no | — | — |
| `runKill` (static kill), `killStaticBySword`, `killIceTurretInPlace`/`BySpear`, `circleKillIceTurret`, `killForCorpse`, `circleKillForCorpse` | no (they ARE the strike; the press is planned) | — | — |
| boss / scripted policies (`playLavaBossPolicy`, `playTotemPolicy`, `playTentacleBeastPolicy`, `execBobBossEncounter`, `execWitchEncounter`, `execYetiTalk`, `execFight`) | no | — | — |
| scripted verbs (`execBurn`, `execWand`, `execTalk`, `execApproach`, `execSkirt`, `execPulse`, `execKeylock`, `execTouch`, `execPull`, `execRopeCutOnce`, `execSpearPress`, `execFireMovePress`, `execCorpseWeigh`, `execDrill*`, `runFire`, `runSpear`, `runTouch`, `runKeyLock`, `faceTowards`, `holdUntilUnfrozen`, `coastThroughTransport`) | no | — | — |
| `orbitKillChaser` / `chaserOrbitKill` (named by the brief) | **does not exist on `main`** (no symbol anywhere in the tree at `12b0c124`) | — | — |

## The missed-opportunity census (a tick where a strikeable body — `strikePolicy.strikeCandidates`, owed empty — is in reach while the driving executor did not consult a live policy)

Instrument: `tools/opp-census.mjs` / `opp-register.mjs` (a load hook wraps `levelRun.createLevelRun`, so every run any
solver builds is censused; the executor is the innermost `solverBot`/`botDriverV2` frame under `advance`; "consulted"
= a `strikeBodies` read from a live decide site on that tick).

| workload | in-reach ticks | consulted | missed | where |
|---|---|---|---|---|
| step 67 (node `solveSegment`, chest (880,816)) | 95 | 0 | **95** | **all in `execKillByPressOnce`**, t651…t779, `bob@736,752` (+ `bob@736,800` from t712); the first contact lands at t660 |
| L18, all 45 residues (`r9-solve-18`, the sweep's `solveAt`) | 0 | 0 | 0 | no chaser is ever in reach (45/45 SOLVE) |
| generated: post-sword `empty`, seeds 30 / 2 / 5 / 9; and `elements: killgate`, seeds 2 / 5 / 9 | 0 | 0 | 0 | the generated palette places no chaser (`free-roaming-bob` is excluded; the killgate clearer is a spinner) |
| L40, the 52 captured legs (`census-l40-off.txt`) | see that file | | | |
