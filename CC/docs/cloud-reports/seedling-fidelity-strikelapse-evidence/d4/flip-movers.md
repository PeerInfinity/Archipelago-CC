# strikeIframeLapse default flip: the movers at the strikelapse head (HELD; the default stays OFF)

Measured at head 9943848 + `flip-candidate.patch` (md5 5fbe0e27f4ff848d13b7112c20f1da2b; applies with `git apply`).

## Code
- `contactFidelity.js`: `strikeIframeLapse: true` (+ its doc line; `<the licence>` to fill).

## Identity block (flip tree vs W0 at head OFF)
- ENEMY census default: afdc6d1a -> **36b59445** (FLIP14's licensed value).
- solve-seedling-r9-campaign --check: 712f0ead -> **dce96321 exit 1** without the campaign patch,
  **6b1bf15c exit 0** with it (FLIP14's candidate digest, re-measured here, not copied).
- Every other row unchanged (maze, acceptance, c3/c6/c4, guard, AREA, killgate x3, levels x2, generated set OK,
  the other five --checks). Reference: regenerate at landing (docs word counts only).

## Committed artifacts (FLIP14's held campaign patch, inside flip-candidate.patch, game-recorded by FLIP14)
- 15 tapes: r9-solve-14 (walk 98 -> 103), -15 (boot), -16 (walk 688 -> 655), -18 (walk 518 -> 440), -12 (inputs),
  -19, -20, -13-v2, -0-v3, -21, -22, -29, -31, -30, -32 (boot only); 4 expectations (-12/-14/-16/-18);
  4 traces; tape index; `playthroughWalk.js` {18,0} removedAt 367 -> 306. Chain endsAt 10931 -> 10825.

## Test re-pins (all in the patch)
- FLIP14's 31 strike rows (21 bounded + 9 CI-caught + the default pins), applied by 3-way at this head and
  re-measured green: solverBot 12b' x4 + 12c x2, solverDeadline, fidelityBobSoldier2 D2 x4 (OFF controls),
  fidelityL30KeyLock x5+1, fidelityLeash 629, fidelityIceTurretSpear C3, seedlingCanCross x2, ropeSword PULL,
  fidelityDash x4, seedlingRobust x4, spearPush L65; contactFidelity + fidelityL74Leg624 default pins.
- HAMMER ARC's pins: `fidelityF1c` CHAIN_RESIDUE 40 -> 12 (re-pinned in the patch; the only red of the
  126-file bounded set before it); `playthroughWalk` {18,0} removedAt 306 (in the campaign part);
  12b' x4 and `solverDeadline` (FLIP14's values, unmoved by this slice's D1/D2: green).

## Bounded set with the flip
- 126 files (the 104 of W0 + the 36 test files naming a moved tape, minus overlap): 4,557 passed / 1 failed
  (fidelityF1c 40 -> 12) before the F1c re-pin; fidelityF1c 13/13 after.
- tapeRunner pairs: 611, 86af85259c2ab3a51b1f0ebb409743f4 (unchanged).
- NOT measured: the unfiltered CI suite with the flip (no measurement commit pushed: it would move committed
  tapes on the branch). FLIP14's CI found 9 rows beyond its bounded set; all 9 are in this patch.

## Survey / sweep with the lapse ON (= the flip's behaviour)
- Survey (local) vs CI 38310171450: SOLVED 169 -> 170; 50: 460 -> 413; 62: 386 -> 748; 147: REFUSED -> 504;
  22 more length movers and 7 text movers (evidence/d3/survey-movers-on-vs-ci-base.json).
- Sweep L74 key set: 624 refused -> done; 622/626/629 done; 628 refused (text moves).
