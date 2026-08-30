# `fixtures/refuted/` — the recordings that REFUTED the model

A withdrawn recording is a free oracle (§10.3's disposition, R8 slice 2). What
is here is a tape the GAME replayed and whose model was WRONG, kept with the
game's own stream beside it, so the defect it found can never come back
silently.

⛔ **These are NOT roster fixtures.** `fixtures/index.js` derives the tape
roster from `fixtures/tapes/` only, so nothing here enters the differential:
these tapes are read BY NAME, by the tests that own the finding. A refuted tape
in the roster would be a permanent red or a silenced one, and neither is a
finding (§22.7).

| file | what it refuted | where the account lives |
|---|---|---|
| `r8-solve-5.tape.json` + `.expectation.json` | The first walk R8 slice 4's two-pass loop produced. The game reported `hits: 1` against the model's 0, first divergence at t=207. R8 slice 5 localised it to **three** model defects — the missing player-arrow bill, an arrow moving on its own spawn tick, and the trap arming one frame too fresh — and the fixed model now reproduces this stream byte for byte through tick 276, hit included. It is also the **negative oracle** for the ETA-aware transit probe (⚖ kickoff §13.10a gate (i)). | kickoff §13.1/§13.2 (the refutation), §14 (the fixes), `r8Acceptance.R8_ETA_PROBE` |

The full bank — trace, `--win` log and the original file names — stays in
`NewDocs/plans/r8-slice4-l5-refuted/`. What is copied HERE is exactly what a
committed gate has to be able to read: `NewDocs` is deliberately gitignored, so
a test that reached into it would be a gate that disappears on a fresh clone.

## ⛓⛓⛓ R9 SLICE 12e⁗ — the EIGHT the game refused by ONE ULP · ⛔ RETIRED AT R9 SLICE 12h

The third re-record run (kickoff §37) drove all thirteen licensed walks in the
real game, got the game's answer on every row, recorded all thirteen — and
`--record`'s own differential then reported **eight** of them
`⛓⛓ THE MODEL REPRODUCES THE RECORDING IT JUST MADE`, whose text is *"THE
RECORDING IS VALID AND THE MODEL IS REFUTED. Do not commit this fixture."*
Every one diverged by ~1 ULP at a single tick and never recovered
(`r8-d2` · `r8-d2-19` · `r8-d2-20` · `r8-solve-18` · `r8-solve-20` ·
`r9-solve-0` · `r9-solve-13` · `r9-solve-14`). The attribution — two ULP
sources inside ONE AS3 expression, neither sufficient alone, failing **iff** a
tape holds a DIAGONAL dash — is kickoff §37.6 and §38, and the discriminating
rows that do NOT need these files live on in `ulpDash.test.js`.

⛔ **THE EIGHT FILES ARE GONE, BECAUSE THE SERIES LANDED AND THE ROSTER NOW
CARRIES THEM.** A withdrawn recording is a free oracle only while the roster
does not hold it. R9 slice 12h landed the parked series, and **measured before
removing anything: all eight banked EXPECTATIONS were byte-identical to the
roster's** — the recordings the game refused ARE the roster's recordings, and
the whole-roster replay asserts every tick of every one. §38.8 called
re-pointing the rows at the roster the WEAKER choice (a pin that reads a roster
tape stops pinning the moment a later licence moves that tape), so they were
retired instead.

⚠ **AND THE GUARD THAT WAS SUPPOSED TO ANNOUNCE THIS DAY DID NOT.**
`ulpDash.test.js` asserted that each banked tape DIFFERS from the roster tape of
the same name, with a comment naming the day the series lands as the day it goes
red. The series landed and the row still PASSED — ⚖ ruling 57's `sound` pin
arrived in the same run and left the tapes differing by one field that has
nothing to do with the claim (six by `pins` alone; `r9-solve-13` and
`r9-solve-14` by `pins`, `rng` and `tick0`). A guard that survives on an
unrelated difference is a green row whose subject has left.

