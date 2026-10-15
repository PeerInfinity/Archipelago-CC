# Noiz2sa difficulty model: is it optimistic at high skill?

Measurement run of 2026-10-14/15, branch `claude/noiz2sa-difficulty-optimism-92lgz8` (from `origin/main` at
`0b77b2f`, game submodule `bulletml-dodge` at `7423ee8`). Nothing in pricing, the difficulty table or any preset was
changed. Raw per-cell data: [`noiz2sa-optimism-raw.json`](noiz2sa-optimism-raw.json) (every attempt's frames and hit
scene, plus each cell's summary).

**Answer: yes, at skills 95–97 on the default final span, by about 2× on the per-attempt rate (1.6–1.8× on mana). The
error is mostly in the BOSS scene, partly in 10:9, and comes from reading a 16-seed table between sparse skill points.
At skills ≤ 93 and on the early regions the model is close (within ~10%).** Below skill ~90 the final span is
effectively unwinnable, and the model's `P_FLOOR` hides that (the skill-80 world drains ≥ 3.5× its plan).

## How it was measured

`scripts/test/measure-noiz2sa-grid.mjs` (new; committed) plays a span at a skill exactly as
`measure-noiz2sa-pricing.mjs` does — `runSegment`, restart on hit, attempt *a* of visit *v* on
`attemptBotSeed(v, a)`, equal tracks at the skill, observed perception, centered hitbox, game seed 1 — and keeps every
attempt. `scripts/test/summarize-noiz2sa-grid.mjs` (new) makes the tables. I checked that the bot's knobs from
`trackKnobs(equal s)` are identical to the sweep's `settingByName('skill s')` at 0/50/90/95/100, so the bot measured
here is the bot the table was built from.

- **Measured p** = clears ÷ attempts over all visits (the MLE of a geometric run censored at `--max-attempts 100`;
  attempts are independent bot seeds). 95% interval: Wilson.
- 200 visits a cell, at most 100 attempts a visit, but a cell stops starting visits after ~1000 attempts
  (`--attempt-cap`), so hopeless cells have 25–40 visits (2300–3000 attempts) and mid cells 150–160. Those cells
  are marked by visits < 200.
- 4 CPUs; the simulator runs ≈ 7 game seconds per CPU second, so a hard cell is ~30 min.

**Not run** (stopped at the user's call on 2026-10-15 — "accept the current results, and document the inaccuracy"):
the spans `pickSpan` would choose at each skill (`pick:1/2/4`), the 9-scene `1:1–1:9`, the mid-game `5:4–5:6`, the
fresh-start single scenes at 90–97 and the measured triple `10:7–10:9`. The single scenes at skill 85 did run. Note: the
brief's "9-scene span (1:9)" is one scene, stage 1 scene 9; `1:9` is what `noiz2sa_priced_test`'s first region plays.

## 1. Per-attempt deathless rate: model vs measured

`×` = the model's product-of-scenes path (no own measurement for that span). E = mean seconds a visit plays until
the clear; `+` = a lower bound (some visits hit the 100-attempt cap).

| span | skill | model p | measured p (95% CI) | attempts | visits | censored | E model (s) | E measured (s) | E ratio |
|---|---:|---:|---|---:|---:|---:|---:|---:|---:|
| 10:7–10:boss | 0 | 0.000× | 0.000 (0.000–0.002) | 2500 | 25 | 25 | 236.7 | 530.7+ | ≥ 2.2 |
| 10:7–10:boss | 50 | 0.000× | 0.000 (0.000–0.002) | 2500 | 25 | 25 | 256.5 | 800.3+ | ≥ 3.1 |
| 10:7–10:boss | 80 | 0.001× | 0.000 (0.000–0.002) | 2960 | 30 | 29 | 338.0 | 1176.4+ | ≥ 3.5 |
| 10:7–10:boss | 85 | 0.009× | 0.004 (0.002–0.007) | 2601 | 30 | 20 | 496.8 | 1606.8+ | ≥ 3.2 |
| 10:7–10:boss | 90 | 0.032× | 0.013 (0.009–0.018) | 2320 | 40 | 11 | 688.8 | 1323.3+ | ≥ 1.9 |
| 10:7–10:boss | 93 | 0.116× | 0.134 (0.115–0.155) | 1121 | 150 | 0 | 256.1 | 268.7 | 1.05 |
| **10:7–10:boss** | **95** | **0.270×** | **0.140 (0.121–0.161)** | 1142 | 160 | 0 | 140.1 | 250.4 | **1.79** |
| 10:7–10:boss | 97 | 0.625× | 0.366 (0.327–0.408) | 546 | 200 | 0 | 77.7 | 126.1 | 1.62 |
| 10:7–10:boss | 100 | 1.000× | 1.000 (0.981–1.000) | 200 | 200 | 0 | 58.7 | 59.7 | 1.02 |
| 1:9 (1 scene) | 0 | 0.469 | 0.428 (0.384–0.474) | 467 | 200 | 0 | 25.8 | 28.9 | 1.12 |
| 1:1–1:2 | 46 | 0.530× | 0.505 (0.456–0.554) | 396 | 200 | 0 | 45.2 | 46.3 | 1.02 |
| 5:1 (1 scene) | 34 | 0.512 | 0.444 (0.399–0.491) | 450 | 200 | 0 | 23.6 | 26.0 | 1.10 |
| 10:7 (fresh) | 85 | 0.281 | 0.294 (0.261–0.329) | 680 | 200 | 0 | 34.9 | 37.8 | 1.08 |
| 10:8 (fresh) | 85 | 0.563 | 0.631 (0.577–0.682) | 317 | 200 | 0 | 22.5 | 22.2 | 0.99 |
| 10:9 (fresh) | 85 | 0.438 | 0.289 (0.256–0.323) | 693 | 200 | 0 | 24.7 | 39.6 | 1.60 |
| 10:boss (fresh) | 85 | 0.125 | 0.193 (0.170–0.218) | 1037 | 200 | 0 | 50.3 | 40.5 | 0.81 |

The earlier n = 8 finding holds up with ~1100 attempts: at skill 95 the model says 0.27 and the bot clears 0.14. The
curve is not smooth: the measured rate is FLAT from 93 to 95 (0.134 → 0.140) where the model more than doubles
(0.116 → 0.270). The bot's knobs do change between 93 and 95 (reaction 5→4, lapse rate 0.7→0.5, …), so this is the
bot's real curve, not a quantised skill.

## 2. Where the error comes from: per scene

Each scene's conditional pass rate INSIDE the 10:7–10:boss runs (attempts that got past the scene ÷ attempts that
reached it), against the model's `sceneChance` (the smoothed, interpolated table value):

| skill | 10:7 model / meas | 10:8 model / meas | 10:9 model / meas | 10:boss model / meas |
|---:|---|---|---|---|
| 80 | 0.125 / 0.139 | 0.438 / 0.422 | 0.313 / **0.080** | 0.063 / 0.071 (n 14) |
| 85 | 0.281 / 0.329 | 0.563 / 0.632 | 0.438 / **0.256** | 0.125 / 0.072 |
| 90 | 0.438 / 0.434 | 0.688 / 0.733 | 0.563 / **0.336** | 0.188 / 0.117 |
| 93 | 0.563 / 0.673 | 0.875 / 0.899 | 0.688 / 0.655 | 0.344 / 0.338 |
| 95 | 0.688 / 0.641 | 0.938 / 0.893 | 0.813 / 0.696 | 0.516 / **0.352** |
| 97 | 0.844 / 0.830 | 0.969 / 0.956 | 0.906 / 0.838 | 0.844 / **0.551** |
| 100 | 1 / 1 | 1 / 1 | 1 / 1 | 1 / 1 |

(95% intervals are in the raw JSON; for 10:7/10:8 they are ±0.02–0.04, for the boss ±0.04–0.05 at 93–97.)

- **Not uniform.** 10:7 and 10:8 match the table at every skill. The error sits in **10:9** (0.26–0.6× the model at 80–90,
  0.85× at 95) and in **the boss** (0.68× at 95, 0.65× at 97). At 95 the four scene ratios multiply to 0.52, which
  is the whole span error (0.140 / 0.270).
- **The boss is a skill-curve (interpolation) problem.** The table's boss row is 5/16 at 94, 11/16 at 96 and 16/16
  at 98. Linear reading gives 0.52 at 95 and 0.84 at 97, but the measured boss rate is 0.35 at both 93 and 95 and
  0.55 at 97. The real curve is flat and then steep, between 97 and 98. The 16-seed points (±0.12 each) plus linear
  interpolation across the 96→98 jump put most of the error exactly where the default Victory skill sits.
- **10:9 is mostly table noise, with some carry-over.** Fresh-start 10:9 at 85 measures 0.289 against the table's
  0.438 (its 16-seed row is 0/2/2/0/1/5/9/9/14/12/16 of 16 at skills 30–98, noisy and non-monotone). Inside the span it is
  0.256, about the same, so carry-over from 10:8 is small there.
- **Product independence is a minor effect here.** Where the scenes have own-span rates, the product of the in-span
  rates equals the span rate by construction. The fresh-start scenes at 85 differ from in-span ones for the boss only
  (0.193 fresh vs 0.072 in-span, n = 138 reached), a hint that entering the boss from 10:9 is harder than starting
  at it. The existing `modelVersusMeasured` (aligned triples, 16 seeds) shows the same thing at a lower level: the
  measured triples come out at 0.71–0.92× of the product at 90–96.
- **`P_FLOOR` makes low-skill E far too optimistic.** `E` floors p at 1/32, so wherever the true p is below ~0.03 the
  model's E is a fixed ~240–690 s while the real expected visit runs to thousands of seconds (≥ 2–3.5× the model even
  censored at 100 attempts). This matters as soon as `noiz2saVictorySkill` is set below ~90 with the default final
  span.

## 3. Mana per visit vs planned

Mana = mean over visits of floor(game seconds) × the region's rate, as the drain charges. The Victory region's numbers
come from the 10:7–10:boss grid cell at the same skill (identical visits).

| world | region | span | skill | rate | planned | measured mana | ratio |
|---|---|---|---:|---:|---:|---:|---:|
| `noiz2sa_priced_test` (Victory skill 95, committed) | region_0_0 | 1:9 | 0 | 0.6205 | 16 | 17.7 | 1.11 |
| | region_1_0 | 1:1–1:2 | 46 | 0.4665 | 21 | 21.5 | 1.02 |
| | region_1_1 (Victory) | 10:7–10:boss | 95 | 0.2213 | 31 | **55.3** (median 42.7, p90 109.8) | **1.78** |
| same world, `noiz2saVictorySkill` 80 (scratch) | region_0_0 | 1:9 | 0 | 0.6205 | 16 | 17.7 | 1.11 |
| | region_1_0 | 5:1 | 34 | 0.8892 | 21 | 22.9 | 1.09 |
| | region_1_1 (Victory) | 10:7–10:boss | 80 | 0.0917 | 31 | **≥ 107.8** (29/30 visits censored) | **≥ 3.5** |

The skill-80 world was generated with `generate-noiz2sa-priced-test-preset.mjs`'s own path plus
`procgenParams.noiz2saVictorySkill = 80` into a scratch dir; nothing was committed. The model prices its final at
p = 0.0011 and E = 338 s (the floor); the measured bot clears it at ≈ 0.0003 per attempt (1 in 2960). With no retry
cap a bot visit would run for hours, and the mana is unbounded in practice. The skill-95 world regenerated byte-identical
to the committed preset.

## 4. Correction options

Ordered by cost.

1. **Add the measured final span to the table (recommended; data-only, easy).** Put this run's 10:7–10:boss curve
   (skills 0, 50, 80, 85, 90, 93, 95, 97, 100; ~200–3000 attempts each, L and F from the attempts) into
   `noiz2saDifficultyData.js` as a measured span, so `spanDifficulty` uses its own cell for it, as it already does
   for the aligned triples. It needs a small extractor change (or a second data block) and a re-pin of the
   difficulty/pricing unit tests and the priced preset.
   *Changes in priced worlds:* only worlds whose final span is the default. At Victory skill 95 the final's p becomes
   ≈ 0.14 and E ≈ 250 s, so its rate drops from 0.2213 to ≈ 0.124 and a visit drains the planned ~31 instead of ~55.
   The pace, the ramp and every other region are unchanged. It does not fix a non-default `noiz2saFinalSpan`, and it
   does not fix the P_FLOOR problem below skill ~90 (that span is simply ≈ unwinnable there).
   *Cost:* the data is already in `noiz2sa-optimism-raw.json`; roughly an hour of code plus test re-pins.

2. **Re-sweep the table densely at high skill.** Rerun the game repo's `segment-sweep.mjs` for every scene at skills
   91–99 step 1 with 64+ bot seeds (it shards on GitHub Actions). This fixes the boss/10:9-style interpolation error
   for every span and every final setting, not just the default. *Changes:* every region priced at skill ≥ 90 (the
   final, and late ramp regions) moves; low-skill regions are untouched. *Cost:* CI hours (100 scenes × 9 skills × 64
   seeds ≈ 58k single attempts; the boss cells are the long ones), plus a regenerate of the data file and preset.

3. **Guard the Victory-skill setting / `P_FLOOR` (independent of 1–2).** When the final span's model p at the Victory
   skill is under ~0.05, price E without the floor (or with a much lower floor) and warn in the generation form that the
   final is ~unwinnable at that skill, or move the final span down by the 50% rule as the fallback path already does.
   *Changes:* only worlds with a low `noiz2saVictorySkill`. The default 95 is unaffected. *Cost:* small code plus a test.

A blanket per-span correction factor (e.g. ×0.55 on p at skills 94–97) would match this one span but is not supported
by the other cells: 1:9, 1:1–1:2, 5:1 and the 93 cell are all within ~10%. Changing the 50% rule's target would not
help the final, which is priced at its fixed span, not by the 50% rule.

**If no fix is taken**, the documentation line to carry is: *the difficulty model is within ~10% on per-attempt rate
for early/mid regions and at skill 93, but on the default final span 10:7–10:boss it is ≈ 2× optimistic at skills
95–97 (measured p 0.14 at 95 vs 0.27 modelled; the final costs ≈ 1.8× its planned mana) because the boss's 16-seed
table is read linearly across a flat-then-steep curve; below skill ~90 that span is effectively unwinnable and its
priced E is a floor, not an estimate.*

## Reproduce

```
git submodule update --init frontend/modules/bulletml-dodge
(cd frontend/modules/bulletml-dodge && npm install --no-save --no-package-lock --omit=dev)
node scripts/test/measure-noiz2sa-grid.mjs --skills 0,50,80,85,90,93,95,97,100 --spans "10:7–10:boss" \
     --visits 200 --max-attempts 100 --attempt-cap 1000 --jobs 4 --chunk 5 --out A.json
node scripts/test/measure-noiz2sa-grid.mjs --rules <rules.json> --skip-final --visits 200 --attempt-cap 1000 --out E.json
node scripts/test/measure-noiz2sa-grid.mjs --skills 85 --spans "10:7,10:8,10:9,10:boss" --visits 200 --chunk 1 --out B.json
node scripts/test/summarize-noiz2sa-grid.mjs A.json E.json B.json --merged noiz2sa-optimism-raw.json
```
