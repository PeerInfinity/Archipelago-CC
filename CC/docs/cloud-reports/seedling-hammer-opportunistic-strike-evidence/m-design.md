# OPP M — the design check, per executor that misses opportunities

Only two executors were MEASURED missing opportunities (`executor-census.md`, `census-step67-off.txt`,
`census-l40-off.txt`): the press kill (step 67: 95 ticks; the 52 L40 legs: 400 ticks, `375:0` 122 and `848:1` 278) and
the axis-aligned walks (the L40 legs: 262 ticks). Every other executor with a body in reach already consults the policy
(`drive` on its non-axis-aligned walks: 1,937 ticks consulted; `runDwell`: 6). The brief's other candidates are
classified by reading.

| executor | safe to add a strike? | how the preview carries it | verdict |
|---|---|---|---|
| **press kill** — strike walk, refuge walk, the stand at the strike cell, the refuge wait (`execKillByPressOnce`'s walk branch) | **yes, with three guards**: (1) the policy is offered only bodies whose AIM and PRESS land clear of the spinners (`safeStep` never swaps a press, and an aim it swapped would leave the policy's owed press facing the wrong way); (2) no opportunistic aim on a tick the kill aims, presses, follows its escape or drives the fight, and the kill does not aim while an opportunistic press is owed; (3) the kill's own spinner aim WAITS while a press would dash because of an opportunistic swing (its train was certified for a plain swing; `set slashing`'s dash branch has no `!slashing` term) | `deriveStrike`'s `walkTo` and `deriveRefuge`'s candidates are previewed with a policy from `strikePolicyFor` AND the same body offer (`oppStrikeOffer`, asked of `previewViewAt`'s view at the previewed tick) | **BUILT** |
| press kill — the fade tail (counted bodies dead) | moot: nothing left to strike in the room's count; stands `NO_KEYS` | — | not touched |
| axis-aligned walks (`walkToUnder`'s `axisAligned`, a level once skirted — Swim U2 / fidelity PROXIMITY) | **NO, not as the policy stands**: an aim key toward a body off the held axis adds the second axis back, and the lane admits one x exactly (L29: 126.000; survey step 57 measured an unrecoverable 125.34). A grid-preserving strike (aim only along the held axis, or only bodies the current axis faces) is a different policy row and needs its own measurement | the preview is strike-free on purpose, like the drive (they agree) | **hand-over** (not built) |
| holds (`runHold`) | **no**: it pushes `NO_HELD` and refuses a tick that moved; an aim is a move. And `botDriverV2.js` is out of this slice's boundary | — | not touched |
| paced waits (`MOVING_WAIT`, `runPace` / `planPacedWait`) | not measured missing (0 in-reach ticks on every workload); `runPace` is `botDriverV2.js` | — | not touched |
| TIME-rung movers (stall walks) | already strike-armed (`strikePolicyFor` at every stall site) except the axis-aligned ones (above) | — | nothing to add |
| collects' approaches (`runCollect`, `execCollect`'s keep-grid) | not measured missing; the keep-grid approach is axis-aligned (above); `runCollect` is `botDriverV2.js` | — | not touched |
| fidelity's orbit kill (`orbitKillChaser`, `chaserOrbitKill`) | **not on `main`** | — | — |

## Step 67, the three arms (`m-step67-arms.txt`)

| arm | verdict | hits | wall |
|---|---|---|---|
| OFF | REFUSED t780: the press kill's death (`bob@736,752`) | 660 / 749 / 780 | 27 s |
| drive only (the previews strike-free) | REFUSED t1420 at the chest stance (`bobsoldier@880,832`) | none | 387 s |
| **drive + previews (BUILT)** | REFUSED at the chest stance (`bobsoldier@880,832`); the spinner kill completes, `bob@736,752` dead (hits t653/t683/t722) | none | 52–84 s |

The drive-only arm is the ⚖ 30(c) gap made visible: a drive that strikes off a strike-free certificate re-derives
constantly (7× the wall time) — the certified walks did not include the strikes the drive then made.

## The L40 radius (59 captured requests, each replayed at its own seam, fresh process; `radius-l40.txt`)

57 identical, 2 movers, both a refusal moving one link on to `bobsoldier@880,832`:
- `375:0` (Chest): OFF refused at the x≈743 corridor on `bob@736,752` → ON the press kill struck it twice and the
  chain reaches the chest stance's `bobsoldier@880,832`;
- `848:1` (Boss Key 2 from `in_L43_176_464`, PKC's 860): OFF the press kill DIED at t822 to `bob@736,752` → ON the
  kill KILLS BOTH x≈744 bobs (`bob@736,752` t670/721/751, `bob@736,800` t725/768/798) and the chain reaches the burn
  stance, refused on `bobsoldier@880,832`.
- `847` (Boss Key 2 from `in_L39_144_0`, PKC's 859): unmoved — it refuses at the burn stance's CORRIDOR on
  `bob@736,752` before the press kill runs (the walk already strikes; the ladder finds no corridor past the pair). That
  is the chooser's pair problem.
