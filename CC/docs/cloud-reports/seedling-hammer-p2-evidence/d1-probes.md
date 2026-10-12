# D1 probes (scratch worktree at `11e113e`, each patch applied, run once, reverted)

All on staging A: `view-solve.mjs --view=frontend/modules/seedlingDemo/fixtures/hammer-p1-l40-south-boot.json
--goal=collect:880,816 --stop-tick=1`. Every probe run printed the base refusal (keys `af47d35d`, msg `b02571c9`).

## Probe 1: every press-kill preview logged (`d1-preview-log.json.gz`, `d1-preview-log-analysis.txt`)

`deriveRefuge`'s and `deriveStrike.walkTo`'s `previewWalk` calls each pushed
`{c: 'R'|'S'|'SC', t: run.ticksCompleted, s: JSON.stringify(run.state), x, y, n: samples.length,
tr: truncated?.kind, best: <refuge's best eta so far>, ms}`. `pwan.py` reads it.

- within one tick, strike and refuge previewed the same target from the same state **once** in 1,329 ticks;
- across ticks, (state, target) repeated for 4,880 of 5,420 strike previews and 14,434 of 15,780 refuge previews,
  but the result (length, truncation) differed in **104** of those pairs: `run.state` is not the preview's key;
- 4,627 refuge previews and 2,325 strike previews **stalled** (400 ticks, `DEFAULT_MAX_TICKS_PER_TARGET`): 2.78 M of
  the 3.71 M preview samples;
- 2,118,794 of the refuge's 2,145,515 samples were taken after the walk had passed the best ETA already found.

## Probe 2: a one-entry stepper memo, and the strike line across derivations (`d1-fixedpoint-and-lines.log`)

- In `previewWalk`'s transit loop: would `step(st, held)` have been answered by the previous call
  (`sameValue(st, lastIn) && sameValue(held, lastHeld)`, no dash impulse)? **0 of 3,709,203**.
  `d1-stuck-state-diff.txt` shows why: a player pinned against a wall keeps `x, y` but `vy` cycles and drifts
  (−1.10, −0.85, −1.40, −1.15, …), so no state repeats.
- In `lineOnce`'s miss arm: was this (world, `liveGeometryOpts()` by value, four truncated ints) asked by an earlier
  derivation? **74,131 of 76,633**; `collideLineSolid` cost 26.5 s.

## Probe 3: the refuge's ETA bound (NOT shipped; `d1-refuge-eta-bound-scratch.log`)

`deriveRefuge` passed `stopWhen: () => (seen += 1) > (best ? best.eta : Infinity)` to each candidate's preview: a
candidate whose walk is already longer than the best is cut where it passes it. Same refusal, ticks, keys and message
(117.0 s, loaded box, P2 not applied). Not exact in general: the cut skips the forecast and stepper calls after it,
so a death or a forecast `throw` the full preview would have raised there is not raised, and D1's `progressPreview`
counts fewer preview states. A behaviour decision, not a cost one.
