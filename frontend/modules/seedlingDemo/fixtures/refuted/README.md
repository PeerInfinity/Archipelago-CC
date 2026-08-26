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

## ⛓⛓⛓ R9 SLICE 12e⁗ — the EIGHT the game refused by ONE ULP

The third re-record run (kickoff §37) drove all thirteen licensed walks in the
real game, got the game's answer on every row, recorded all thirteen — and
`--record`'s own differential then reported **eight** of them
`⛓⛓ THE MODEL REPRODUCES THE RECORDING IT JUST MADE`, whose text is *"THE
RECORDING IS VALID AND THE MODEL IS REFUTED. Do not commit this fixture."*
Every one diverged by ~1 ULP (7.105427357601002e-15 px, one of them 2× and one
4× that) at a single tick and never recovered. These are those eight, banked
here for exactly the reason the row above was: **a withdrawn recording is a
free oracle.**

⛔ **THEY ARE NOT THE ROSTER'S, AND THAT IS DELIBERATE.** The thirteen walks
belong to the parked series on local `r9/re-record-attempt-4` (tapes
`299387a63`, recordings `763bf3cb8`), which lands WHOLE in the re-record's
fourth run under the one-series law — never piecemeal. `fixtures/index.js`
derives the roster from `fixtures/tapes/` only, so copying the eight here spends
no tape licence and leaves the committed roster at **149**.

| file | what it refuted | where the account lives |
|---|---|---|
| `r8-d2.{tape,expectation}.json` · `r8-d2-19` · `r8-d2-20` · `r8-solve-18` · `r8-solve-20` · `r9-solve-0` · `r9-solve-13` · `r9-solve-14` | **Two ULP sources inside ONE AS3 expression**, both wrong in the model and neither sufficient alone. (1) `Player.as:788` hands `knockback` a point BEHIND the player, so the centre it normalises is `x - (x - v.x)` — a POSITION ROUND TRIP the model's spend site skipped by passing `v.x` straight through. (2) `knockbackImpulse` spelled `Point.normalize` with `Math.hypot` + `cx / length` where the game's is `sqrt(x*x + y*y)` + `x * (thickness/length)` — the spelling `pointNormalize` twenty lines away already had. A tape fails **iff** it holds a `primary` double-press released while BOTH a horizontal and a vertical key are held: a DIAGONAL dash. `r9-solve-3`'s 21 AXIS dashes were exact all along, because a normalised axis vector is exactly ±1 whatever the length rounds to. Isolation: round trip alone **10/13**, faithful normalise alone **5/13** (fixes nothing), both **13/13**. | kickoff §37.6 (the attribution), §38 (the fix), `ulpDash.test.js` |
