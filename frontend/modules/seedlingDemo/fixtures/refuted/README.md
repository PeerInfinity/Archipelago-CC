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
