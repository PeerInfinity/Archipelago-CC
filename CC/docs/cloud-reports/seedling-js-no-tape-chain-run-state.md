# Cloud report: `seedling-js-no-tape-chain-run-state`

The no-tape chain now hashes RUN STATE, not the fidelity flag table.

- **Branch:** `claude/no-tape-chain-run-state-bwm92f`. The harness pinned this branch, so the brief's
  `seedling-js-no-tape-chain-run-state` was not used.
- **Base:** `origin/main` @ `16d1b67084` ("train: re-merge origin/main a9327e40cb"). It contains W35:
  `contactFidelity.js:1721` has `turretSnapPricing: true`.
- **Code commit:** `326d604c`. This report is the commit after it.
- **Scope:** test-side only. The one file touched is `frontend/modules/seedlingDemo/jsRuntimeTape.test.js`.
  `levelRun.js`, `jsRuntimeCore.js`, `contactFidelity.js`, vendor, wasm and solver files were not edited.

## The change

- **`NO_TAPE_RUN_PARTS`** (exported) = `['staging', 'place', 'clock', 'player', 'persist', 'visit']`. That is
  `stateDigestParts`' seven parts minus `globals`, in a fixed order.
- **`noTapeChain(create, { between, parts = NO_TAPE_RUN_PARTS })`**: each tick's `run` field is now
  `runStateOf(rt.run, parts)`. That reads `run.stateDigest({ parts: true }).parts` and writes it as
  `name=hash;…` in the given order. It throws on an unknown part name. It used to be `rt.run.stateDigest()`, the full
  digest including `globals`.
  - The new `parts` option exists only so the sensitivity and discriminator rows can hash other part sets.
- **`NO_TAPE_CHAIN`** is re-pinned (see below). The comment records old, new, method and cause.
- **New `describe`, "the no-tape chain hashes RUN STATE, not the fidelity flag table"**, with four rows (see Pins).
- The file header's point 1 now names the run parts.

## Re-measure method (the pinned way)

1. `git show 9c0f904549:frontend/modules/seedlingDemo/jsRuntimeCore.js > frontend/modules/seedlingDemo/_preB_core.tmp.js`.
   It imports today's sibling modules, and it ran on today's tree with no change. Nothing was STOPPED.
2. A temporary vitest file beside the tree imported `noTapeChain` from the test file and ran it over both the pre-B
   core's `createJsRuntime` and today's. Flags were as shipped: 116 keys, 105 ON.
3. **Before the edit** (the old chain, `globals` in), the baseline was reproduced:
   - pre-B core `1f44092f380a801342ab2c06ee51`, and today's core the same;
   - with a dummy key added, `0e676c91cf73ca087d13c08a64b4` on both cores. This is the defect.
4. **After the edit:**
   - pre-B core `0852da9e5639860e8b2d4ccbeda5`, 224 rows, walk `done`;
   - today's core gives the identical value.
5. The temp files were deleted and never committed.

**Old → new:** `1f44092f380a801342ab2c06ee51` → `0852da9e5639860e8b2d4ccbeda5` (rows 224, walk `done`, unchanged).
**Cause:** `globals` is no longer part of the hashed run state.

## Flag-independence evidence

All values below are the new chain, measured at `16d1b67084` with the temp measurement file.

| Run | Chain |
|---|---|
| plain, pre-B core | `0852da9e5639860e8b2d4ccbeda5` |
| plain, today's core | `0852da9e5639860e8b2d4ccbeda5` |
| dummy key `CONTACT_FIDELITY.dummyNoSuchKey = true`, pre-B core | `0852da9e5639860e8b2d4ccbeda5` (equal) |
| dummy key, today's core | `0852da9e5639860e8b2d4ccbeda5` (equal) |
| each of the 11 OFF keys flipped ON alone (`arrivalButtonArm`, `unbilledDamageGate`, `partialDodgeReprobe`, `chaserSpinnerWalls`, `corridorBodyPricing`, `arrowLaneCrossing`, `axePricedCrossing`, `walkerBeamTowers`, `orbitFreeAim`, `strategyBoundDistinct`, `secondaryUse`), today's core | `0852da9e5639860e8b2d4ccbeda5` (all equal) |
| `globals` hashed back in, plain (pre-B and today's) | `16df07a924d1721a86b62a387896` |
| `globals` hashed back in, plus the dummy key | `060630baa5be2e0be51754c51f9f` (moves) |

With the old chain, every one of those eleven flips moved it (e.g. `strategyBoundDistinct` → `0f22f06e…`). That came
from `globals` alone: in run state, all eleven are no-ops on this scenario.

**Key chosen for the committed flip row: `strategyBoundDistinct`.** It is a solver strategy-bound switch. The no-tape
scenario is a keyboard leg plus a walk to the L0 stairs, and it meets no encounter that the solver prices. The table
above shows the flip is a measured no-op here.

`withContactFidelity` refuses unknown keys. So the dummy-key row adds and deletes `noTapeChainDummyKey` on
`CONTACT_FIDELITY` directly, in a `try/finally`, and asserts first that the key is absent.

## Pins and mutants

Rows in `jsRuntimeTape.test.js`: 14 total, all green at `326d604c`.

| Pin | Row |
|---|---|
| `NO_TAPE_CHAIN` at the new value | "the no-tape chain … is the one measured on the pre-Phase-B core" |
| loaded but never started (kept green) | "a tape LOADED but never started leaves every tick of the chain where it was" |
| flag independence: dummy key | "a fidelity table that grows a key no code reads leaves the chain where it was" |
| flag independence: OFF key flipped | "an OFF key flipped ON that alters nothing here (strategyBoundDistinct) …" |
| discriminator | "with `globals` hashed back in, that same dummy key DOES move the chain" |
| run-state sensitivity | "dropping `player` or `visit` from the hashed parts moves the chain" |

Each mutant was applied by `sed` to the test file, run, then reverted from a saved copy:

| Mutant | Result |
|---|---|
| M1: put `globals` back in `NO_TAPE_RUN_PARTS` | **4 red:** the chain pin, loaded-never-started, the dummy-key row and the OFF-flip row. The discriminator row shows the dummy key really moves a globals-in chain, so the independence row reds on the dummy key itself, not only on the pin value. |
| M2: drop `player` from `NO_TAPE_RUN_PARTS` | **4 red** (the same four). Measured drop-player chain: `1b04ffd63fd3750a24a83251d61b`. |
| M3: drop `visit` from `NO_TAPE_RUN_PARTS` | **4 red** (the same four). Measured drop-visit chain: `01c0f870812a7c0dbe37f543b575`. |
| M4: the old behaviour (`run: rt.run.stateDigest()`) | **4 red** (the same four). |

Dropping any single part moves the chain:

| Part dropped | Chain |
|---|---|
| staging | `17a808cd…` |
| place | `0897ab11…` |
| clock | `0c5130e9…` |
| player | `1b04ffd6…` |
| persist | `1a666050…` |
| visit | `01c0f870…` |

## Checks run

- `npx vitest run frontend/modules/seedlingDemo/jsRuntimeTape.test.js jsRuntimeContinuation.test.js jsRuntimeCore.test.js`
  (bounded): **3 files, 43 tests passed**.
- `jsRuntimeTape.slow.test.js` does not import from the edited file (its imports were checked). It was not run.
- No local unfiltered vitest was run (ruling 52). The suite number comes from CI at the pushed SHA.
- **Generated reference:** no generated doc cites `jsRuntimeTape.test.js`. `grep -ar` over `docs/` found nothing; the
  only citations are prose comments in `jsRuntimeCore.js`, `scripts/procgen/*.mjs` and older cloud reports, and they
  stay true. Nothing was regenerated, and there was no `--check` to run.

## STOPPED

Nothing.
