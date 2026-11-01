# CPWIT M — the design check (before any edit)

## What exists today (W0 survey, base `9c0f9045`)

The page's solve worker (`frontend/modules/seedlingDemo/jsRuntimeSolveWorker.js`) is built by
`jsRuntimeSolveService.createWorkerSolveService()`'s default factory (`new Worker(SOLVE_WORKER_URL)`), which is what
`flashPanel/seedlingWasmPlayback.js` (the wasm engine), the divergence sweep's lab (`seedlingDivergenceLab.js`) and
`probe-seedling-wasm-arrival-solve.mjs` use; `jsRuntimePage.js` builds its own with the same URL.

Switch channels that reach the worker today: **five REQUEST STAMPS**, each for one module's own switch set, each set by
a flashPanel SETTING the probe writes before the boot (`stampHooks`):
`killLockBodies`, `contactFidelity` (`--contact-fidelity`), `axeDodgeAskPerPreview` (`--axe-dodge`), `dashOnlyWindow`
(`--dash-only-window`), `dashShape` (`--dash-shape`); plus `upgradeWindowWork` (a request field). The sweep's
`stage_flags` input stages GAME flags, not solver switches.

**There is no channel for `solverBot.js`'s own env switches** (`CHOOSER_PAIR`, `ICETURRET_STATIC_KILL`,
`LATCH_WEIGH_FIRST`, `OPPORTUNISTIC_STRIKE` in `pressKillCost.js`, …): they are read from
`globalThis.process?.env?.SEEDLING_*` when their module is EVALUATED, and the worker has no `process`. Measured: the
worker's static import closure is 136 files reading **150 distinct `SEEDLING_*` names**; every read is the literal form
`process?.env?.SEEDLING_X` (no aliasing), and no module in the closure touches `process` for anything else (checked:
no `typeof process`, `process.versions`, `process.argv` … outside comments), so a bare `{env}` is safe to install.

## Designs weighed

| | A. worker-URL env shim (CHOSEN) | B. a request stamp `solverEnv` applied per solve | C. a flashPanel setting per switch |
|---|---|---|---|
| how | page `?seedlingSolverEnv=NAME=V;…` → the service's worker URL carries the canonical spec → the worker's FIRST import installs `process.env` before any solver module is evaluated | the service stamps the spec on each request; the worker sets each switch inside a `with…` scope per solve | the probe writes a panel setting; `stampHooks` stamps it; the solver applies it |
| covers the existing env names from ONE table | **yes, all 150, unchanged read sites** | no: most switches are module-load constants (`CHOOSER_PAIR.size` is computed at import; `contactFidelity`'s env is assigned at import); each would need a setter and a `with…` | no: one setting + one stamp + one hook per switch |
| new plumbing per later switch | one table line (a red row names it) | a setter per switch, in `solverBot.js` (out of bounds; the parallel slices edit it) | a settings key, a flashPanel edit, a stamp (⛔ flashPanel/* is out of bounds) |
| default | no param → `SOLVE_WORKER_URL` itself, no shim installed, no stamp | no stamp | setting absent |
| per run, never persisted, not a user setting | yes (URL) | yes | **no** (a persisted user setting) |
| touches `flashPanel/*`, `levelRun.js`, `botDriverV*.js`, AS3/wasm | **no** | no | **yes** |

B was rejected because it is not ONE table: it needs per-switch code in the solver. C is excluded by the brief. A
also needs a fresh worker per page load to change the spec, which a sweep already gets (one page per leg).

## The chosen channel (A) — its contract

- `solverEnvChannel.js` (pure, no imports): `SOLVER_ENV_NAMES` (the table), `SOLVER_ENV_PARAM = 'seedlingSolverEnv'`,
  `parseSolverEnv` / `formatSolverEnv` / `canonicalSolverEnv` (names sorted, `;` between entries so a value may hold
  commas), `solverEnvFromSearch`, `solveWorkerUrl(base, search)` (returns `base` ITSELF without a param),
  `installSolverEnv`, `stampSolverEnv`.
- `solverEnvShim.js`: the worker's first import; reads the param off `self.location`; installs; a bad spec installs
  nothing and every solve is refused naming it.
- The worker stamps every `pass` answer, `best` and `result` (and the plan) `solverEnv` = the canonical spec.
- An unknown name refuses BY NAME: in the probe before a browser starts (`--solver-env`), in the worker on every solve.
- The page's main-thread module copies are NOT switched (the game judges a played plan; the page model is the
  divergence detail's only).
- A key whose module also has a request stamp (`contactFidelity`, …) is overridden by that stamp when the page sends
  one (it sends none at the panel defaults).

## The sweep

Yes, the divergence sweep needs an input: **`solver_env`** (string, default `''`), passed as `--solver-env` to the
plan job (so the plan is stamped) and to every shard. It is a measurement input with an empty default, so this slice
adds it (`.github/workflows/seedling-divergence-sweep.yml`). `solverEnv` joins the probe's and the merge's
`SOLVER_KNOB_KEYS`, so rows, the plan, and the mixed-merge refusal come from the existing stamp path.
