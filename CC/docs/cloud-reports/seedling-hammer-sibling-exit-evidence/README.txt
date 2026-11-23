SIBLING-EXIT evidence (slice seedling-hammer-sibling-exit). Base 5634df8868 (main after TRAIN 193).
tools/binding-pit-arrivals.mjs   step 1: the region binding fed an L16 -> L17 pit landing per pit tile (node, no page)
step1/binding-pit-arrivals.jsonl its output: 7/7 landings credited as the exit actually taken
md5-*.txt                        acceptance md5 (batch-seedling-acceptance.mjs | md5sum) at base / tip, switch OFF
licensed-hunks.diff              the controller + survey hunks (base..code head), quoted in the report §4
seedlingDemo-hunks.diff          the seedlingDemo hunks (jsRuntimeSolver, wasmArrival, jsRuntimeCore, jsRuntimeWalker, solverEnvChannel)
tools/sibling-leg.mjs            one leg OFF/ON through the production path (controller → arrivalSolverGoal → solveAnytime)
tools/make-witness-lab.mjs       builds the wasm GAME witness driver + lab from the sweep's (measurement only; removed after use)
tools/witness-summary.py         one line per witness row
tools/survey-compare.py          two survey --out files compared per step (and as whole rows minus wall clock)
tools/census-summary.py          the census rows summarised (movers by KEY, hits gained, extra wall)
step4/wasm-witness-{off,on}.jsonl the 4 L16 legs on the real game, fresh page per leg (trimmed rows)
step4/survey/                    survey --through=end and 4.2: base/OFF/ON rows (gz) and the comparisons
step5/                           the census: 160 legs OFF/ON (census.jsonl.gz), summary, keys, the 21 sibling groups
