# JtA spark-income comparison (2026-07-05)

1000 runs each (runToBudget), baseline profile unless noted. "Earned" = spark held + spark ever spent (spending reconstructed exactly from owned unlocks + repeatable levels). Checkpoints every 50 runs; table shows selected horizons.

| config | @200 | @300 | @400 | @500 | @750 | @1000 | prestiges | lifetime zone |
|---|---|---|---|---|---|---|---|---|
| baseline (stall 20, cheapest) | 110 | 5.24k | 526k | 30.8M | 1.28e+3T | 8.84e+3T | 22 | 31 |
| stall 5 (frequent prestige) | 110 | 440 | 1.43k | 2.94k | 6.92k | 68.3k | 35 | 20 |
| stall 40 | 1.82k | 36.5k | 22.1M | 37.1B | 3.39e+3T | 1.23e+4T | 12 | 31 |
| baseline + spendCap 1.0 | 110 | 24.1k | 10.2M | 601M | 3.81e+3T | 1.30e+4T | 24 | 31 |
| combo profile (cheapest) | 2.38k | 44.8k | 23.5M | 69.7B | 3.46e+3T | 1.25e+4T | 13 | 31 |
| combo profile + spendCap 1.0 | 2.98k | 3.09M | 335B | 1.03e+3T | 8.23e+3T | 1.87e+4T | 13 | 31 |

Verdict: the completion-metric winners are also the income winners at every horizon. Spark gain is exponential in deepest zone reached, so fewer-but-deeper prestiges (stall 40) and unlock-accelerating spending (spendCap) compound; frequent prestiging (stall 5) is catastrophic for income (68k total vs trillions). The "low-prestige configs may cost long-run income" caveat is refuted.
