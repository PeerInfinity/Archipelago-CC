# Noiz2sa difficulty model: is it optimistic at high skill?

Measurement run of 2026-10-14/15, branch `claude/noiz2sa-difficulty-optimism-92lgz8` (from `origin/main` at
`0b77b2f`, game submodule `bulletml-dodge` at `7423ee8`). Sections 1–4 are the measurement as first reported (no
code changed). **Section 5 is the follow-up the user asked for on 2026-10-15 ("please continue with the plan you would
recommend"): option 1 applied, with a calibration run behind it.** Raw per-cell data:
`noiz2sa-optimism-raw.json` (not on main: 1 MB; it is on branch `claude/noiz2sa-difficulty-optimism-92lgz8` at `6aab982eb4`) (every attempt's frames and hit scene, plus each cell's
summary, for every cell in this report).

**Answer: yes, at skills 92–97 on the default final span, by about 2× on the per-attempt rate (1.6–1.8× on mana at
95–97). The table's single scenes are right there; the error is in treating the span as a product of independent
scenes (the boss is harder when reached from 10:9 than from a fresh start), compounded by a step-shaped skill curve
read linearly between table points two skills apart. At skill 93 and on the early regions the model is close (within
~10%).** Below skill ~90 the final span is effectively unwinnable, and the model's `P_FLOOR` hides that (the skill-80
world drains ≥ 3.5× its plan). **Fixed for the default final span (section 5):** the span is now measured as a whole
at every whole skill 90–100, and the committed priced world's Victory region now drains its planned mana at skill 95.

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

**Not run** (the first grid was stopped on 2026-10-15 when the user said they'd likely accept the current results):
the spans `pickSpan` would choose at each skill (`pick:1/2/4`), the 9-scene `1:1–1:9`, the mid-game `5:4–5:6` and the
measured triple `10:7–10:9`. The single scenes ran at skill 85 (first grid) and, for 10:9 and the boss, at 94 and 96
(section 5). Note: the
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
- **The boss is a carry-over problem, not a table problem** (corrected in the follow-up; this bullet first blamed the
  interpolation). The boss played ALONE from a fresh start matches the table: 0.407 measured vs 0.344 at 94, 0.662 vs
  0.688 at 96 (200 visits each, section 5). Inside the span, reached from 10:9, it passes only 0.338 at 93, 0.352 at
  95 and 0.551 at 97. So the boss is harder when the span arrives at it than when a game starts at it, and the product
  model, which multiplies fresh-start rates, cannot see that. The step-shaped skill curve (the whole span is flat
  from 93 to 95 and from 96 to 97, then jumps at 98) adds to it where the table's points are two skills apart.
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

1. **Add the measured final span to the table (recommended; data-only, easy). — APPLIED, section 5.** Put this run's 10:7–10:boss curve
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
   91–99 step 1 with 64+ bot seeds (it shards on GitHub Actions). ⚠ The follow-up found the single scenes are already
   right at 94–96, so this would fix only the interpolation part; the carry-over into the boss would remain for any
   span the product model prices. A sweep of measured MULTI-scene spans (every span ending on a boss, say) would be
   the version of this that helps. *Changes:* every region priced at skill ≥ 90 (the
   final, and late ramp regions) moves; low-skill regions are untouched. *Cost:* CI hours (100 scenes × 9 skills × 64
   seeds ≈ 58k single attempts; the boss cells are the long ones), plus a regenerate of the data file and preset.

3. **Guard the Victory-skill setting / `P_FLOOR` (independent of 1–2). — APPLIED (the fallback), section 6.** When the final span's model p at the Victory
   skill is under ~0.05, price E without the floor (or with a much lower floor) and warn in the generation form that the
   final is ~unwinnable at that skill, or move the final span down by the 50% rule as the fallback path already does.
   *Changes:* only worlds with a low `noiz2saVictorySkill`. The default 95 is unaffected. *Cost:* small code plus a test.

A blanket per-span correction factor (e.g. ×0.55 on p at skills 94–97) would match this one span but is not supported
by the other cells: 1:9, 1:1–1:2, 5:1 and the 93 cell are all within ~10%. Changing the 50% rule's target would not
help the final, which is priced at its fixed span, not by the 50% rule.

**Before the fix**, the documentation line would have been: *the difficulty model is within ~10% on per-attempt rate
for early/mid regions and at skill 93, but on the default final span 10:7–10:boss it is ≈ 2× optimistic at skills
95–97 (measured p 0.14 at 95 vs 0.27 modelled; the final costs ≈ 1.8× its planned mana) because the boss's 16-seed
table is read linearly across a flat-then-steep curve; below skill ~90 that span is effectively unwinnable and its
priced E is a floor, not an estimate.*

## 5. Follow-up: option 1 applied

The user asked to continue with the recommended plan. Two things changed it from the first draft above. (1) To be
read like a measured triple, the span needs cells at the table's skills, but the table's skills alone would still miss:
the whole span's curve is step-shaped, so the model now reads a measured span on ITS OWN skills. (2) The single-scene
cells at 94/96 showed the table's scenes are right and the boss's error is carry-over (section 2, corrected).

**The calibration** (`measure-noiz2sa-grid.mjs`, same method as section 1; "old model p" is the product of scenes,
which is what the driver printed while those cells ran):

| skill | old model p | measured p (95% CI) | attempts | visits | censored | E measured (s) |
|---:|---:|---|---:|---:|---:|---:|
| 0–70 (8 cells) | 0.000 | 0 in 1300–2500 each | | 13–25 | all | ≥ 530–922 |
| 80 | 0.001 | 0.000 (1/2960) | 2960 | 30 | 29 | ≥ 1176 |
| 85 | 0.009 | 0.004 (0.002–0.007) | 2601 | 30 | 20 | ≥ 1607 |
| 90 | 0.032 | 0.013 (0.009–0.018) | 2320 | 40 | 11 | ≥ 1323 |
| 91 | 0.049 | 0.023 (0.016–0.033) | 1236 | 32 | 3 | ≥ 904 |
| 92 | 0.069 | 0.016 (0.010–0.024) | 1279 | 26 | 6 | ≥ 1069 |
| 93 | 0.116 | 0.134 (0.115–0.155) | 1121 | 150 | 0 | 268.7 |
| 94 | 0.180 | 0.092 (0.076–0.111) | 1045 | 96 | 0 | 375.4 |
| 95 | 0.270 | 0.140 (0.121–0.161) | 1142 | 160 | 0 | 250.4 |
| 96 | 0.360 | 0.354 (0.316–0.394) | 565 | 200 | 0 | 127.0 |
| 97 | 0.625 | 0.366 (0.327–0.408) | 546 | 200 | 0 | 126.1 |
| 98 | 1.000 | 0.995 (0.972–0.999) | 201 | 200 | 0 | 60.6 |
| 99 | 1.000 | 0.971 (0.938–0.987) | 206 | 200 | 0 | 60.1 |
| 100 | 1.000 | 1.000 (0.981–1.000) | 200 | 200 | 0 | 59.7 |

(The 91 cell ran after the data landed without it, so its printed model p, 0.014, was already the measured curve's;
0.049 above is the old product at 91.) The 93/94 and 98/99 pairs are not monotone; the model's isotonic
smoothing pools them (0.114 at 93–94, 0.983 at 98–99).

Single scenes from a fresh start (the carry-over check): 10:9 0.758 at 94 / 0.870 at 96 (table 0.813 / 0.813); boss
0.407 / 0.662 (table 0.344 / 0.688).

**What changed** (branch commits after the report):
- `scripts/data/noiz2sa-measured-spans.json` — per-cell aggregates `{n, deathless, L, F, visits, censored}` at 21
  skills, with provenance; `scripts/test/extract-noiz2sa-measured-spans.mjs --from <grid json…>` writes it and
  generates `frontend/modules/noiz2saSubstrate/noiz2saMeasuredSpansData.js` (`--check` verifies the module).
- `noiz2saDifficulty.js` — a measured span is read like a triple but between its own skills, and a cell with ≥ 30
  failures keeps its own failed-attempt length F (the span's failures last 5 s at skill 0 and 36 s at 96, when they
  reach the boss; a pooled F would put E at 95 far too low). A 16-attempt cell never has 30 failures, so the table
  reads exactly as before: compared with `origin/main` over every span of 1–4 scenes at 19 skills (7486 readings),
  only 10:7–10:boss differs.
- `noiz2sa_priced_test` regenerated: the Victory region's rate 0.2213 → **0.1238** (p 0.27 → 0.140, E 140.05 →
  250.44 s at skill 95); its two locations (priced at skill 100) 58.69 → 59.73 s. Nothing else in the file moved, and
  no other committed preset carries Noiz2sa pricing.
- Unit tests (`noiz2saDifficulty.test.js`): the module matches the json, the span covers every whole skill 90–100
  with ≥ 200 attempts a cell, at skill 95 the model IS the cell (p 0.140, E 240–260 s), the curve is non-decreasing,
  0 below 80 and 1 at 100, and other spans still read as the product or the triple. The five noiz2sa unit-test files
  pass (98 tests); not the unfiltered suite (ruling 52).
- Docs: `docs/json/developer/procgen/noiz2sa.md` § Pricing (the model, the settings line, the test preset), and the
  `DEFAULT_FINAL_SPAN` comment in `noiz2saPricing.js`.

**Expected effect:** with the new rate a Victory visit at skill 95 drains 0.1238 × 250.4 s ≈ 31 mana, the plan (it
drained 55.3 at the old rate). Not re-measured on the page: the in-app row `noiz2sa-priced-world` plays only the
first region, which did not change.

**What it does not fix:** a non-default `noiz2saFinalSpan` is still the product of its scenes (≈ 2× optimistic if it
ends on a boss, by this run); a `noiz2saVictorySkill` below ~90 still prices an effectively unwinnable final at the
`P_FLOOR` bound (option 3 — applied afterwards, section 6). One side effect: the 50% rule considers 10:7–10:boss among the 4-scene spans, so a
NON-final 4-scene region priced at skills ~96–98 may now pick a different span (more accurately).

## 6. Follow-up: the low-Victory-skill fallback (option 3)

The user chose the fallback (2026-10-15, "Please implement the fallback"). `noiz2saPricing.js` `FINAL_MIN_CHANCE`
= 0.05: when the setting's final span has a deathless chance under it at the final region's skill, the final region
is priced by the 50% rule up to the setting's length (`pickShrinking`, the path the no-pace fallback already used)
and its payload records `pricing.finalTooHard: true`; the pace is untouched (it still trains to the Victory skill).
With the measured 10:7–10:boss (0.019 at 92, 0.114 at 93) every Victory skill of 92 or less falls back; 93 and up
play the span. The committed preset (skill 95) does not change.

Measured on the priced test world at Victory skill 80 (scratch, 200 visits a region):

| region | before: span, rate, mana / planned | after: span, rate, mana / planned |
|---|---|---|
| region_1_1 (Victory) | 10:7–10:boss, 0.0917/s, ≥ 107.8 / 31 (29/30 visits censored) | 2:1–2:2 (p 0.508 modelled, 0.365 measured), 0.6215/s, **34.5 / 31 (1.11)** |

The other two regions are unchanged (17.7 / 16 and 22.9 / 21). Tests: `noiz2saPricing.test.js` — Victory skills 80
and 92 fall back (`finalTooHard`, the 50% rule's span, p ≥ 0.5, the pace still at the setting), 93 keeps the span with
no flag; the five noiz2sa unit-test files pass (100 tests). Docs: `noiz2sa.md` § Pricing step 3, the payload, the
settings line.

## Reproduce

```
git submodule update --init frontend/modules/bulletml-dodge
(cd frontend/modules/bulletml-dodge && npm install --no-save --no-package-lock --omit=dev)
node scripts/test/measure-noiz2sa-grid.mjs --skills 0,50,80,85,90,93,95,97,100 --spans "10:7–10:boss" \
     --visits 200 --max-attempts 100 --attempt-cap 1000 --jobs 4 --chunk 5 --out A.json
node scripts/test/measure-noiz2sa-grid.mjs --rules <rules.json> --skip-final --visits 200 --attempt-cap 1000 --out E.json
node scripts/test/measure-noiz2sa-grid.mjs --skills 85 --spans "10:7,10:8,10:9,10:boss" --visits 200 --chunk 1 --out B.json
# the follow-up: the table's other skills and 91 (F, H), and the fresh-start scenes at 94/96 (G)
node scripts/test/measure-noiz2sa-grid.mjs --skills 10,20,30,40,60,70,91,92,94,96,98,99 --spans "10:7–10:boss" \
     --visits 200 --max-attempts 100 --attempt-cap 1000 --jobs 4 --chunk 1 --out F.json
node scripts/test/measure-noiz2sa-grid.mjs --skills 94,96 --spans "10:9,10:boss" --visits 200 --chunk 1 --out G.json
node scripts/test/summarize-noiz2sa-grid.mjs A.json E.json B.json F.json G.json --merged noiz2sa-optimism-raw.json
node scripts/test/extract-noiz2sa-measured-spans.mjs --from A.json F.json        # → the json + the data module
node scripts/test/generate-noiz2sa-priced-test-preset.mjs                       # → the priced preset
```
