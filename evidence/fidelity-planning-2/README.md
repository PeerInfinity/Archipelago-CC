Scratch evidence for the fidelity planning-2 cloud slices (F7, SF). NOT for main; never merged.
Run from the repo root of a checkout: `node evidence/fidelity-planning-2/replay.mjs <capture.json> '<json args>'`
(args: {read: index | {level}, goal?, dashMode?: 'none'|'all', economies?}). Captures are live wasm arrivals
(the JS arc's l16-budget slice, see l16-budget-report.md). l16back-*.json = the planner's synthetic L16 re-arrival from
L17 at (112,48), with / without the rope's {16,0} clear; goal {"kind":"exit","level":16,"tiles":[[1,4]],"name":"level_16 -> level_15__r1c5"}.
probe-arm.mjs reads armedArrowTraps/pulledRopes/latchedGroups after that build. lazy-hook.mjs: `node --import ./lazy-hook.mjs replay.mjs …` applies SF1's prototype transform.
