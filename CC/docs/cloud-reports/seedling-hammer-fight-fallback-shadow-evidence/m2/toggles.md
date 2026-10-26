# M2 — one fresh node process per cell, request 371 i0 (`req-r1`), seam via `atSeamTime`

`=` = identical to the FF ON row (answer sha and work units). Cells: class (work) [fallback rows].

| arm (env) | 5251 | 5264 | 5265 | 5266 |
|---|---|---|---|---|
| default (FF OFF) | refusal@kill (179) `2b108f0c` | refusal@kill (177) `b2edb91f` | refusal@kill (177) `13519ffb` | refusal@kill (177) `13519ffb` |
| `SEEDLING_HAMMER_FIGHT_FALLBACK=1` | **DIVERGE 1795/1260** (162) [rewind:solved@t1112→1260] | **DIVERGE 1775/1237** (159) [rewind:solved@t1112→1237] | **DIVERGE 1775/1239** (159) [rewind:solved@t1112→1239] | **DIVERGE 1775/1242** (159) [rewind:solved@t1112→1242] |
| repeat (fresh process) | = | = | = | = |
| + `SEEDLING_ESCAPE_CROSS_PASS_CACHE=0` | = | = | = | = |
| + `SEEDLING_ESCAPE_CROSS_PASS_CACHE_VERIFY=1` | = | = | = | = |
| + `SEEDLING_HAMMER_FIGHT_FALLBACK_MODE=whole` | = default | = default | = default | = default |
| + `SEEDLING_PRESS_KILL_BOMBS=0` | = | = |  refusal@other (642) [—] |  DIVERGE 1775/1247 (159) [rewind:solved@t1112→1247] |
| + `SEEDLING_STRIKE_ETA_FLOOR=0` |  refusal@hold (259) [admission:refused@t1334] |  refusal@shake (181) [—] |  SOLVE 1781t (526) [admission:refused@t1517] | = |
| + `SEEDLING_HAMMER_ESCAPE=0` | = | = | = | = |
