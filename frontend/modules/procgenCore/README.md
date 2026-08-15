# procgenCore

The **substrate-agnostic half of the procgen generator**: the keep-or-revert
loop, its verdict vocabulary, the template contract and the seeded-draw
vocabulary. Nothing here knows what a level looks like.

- `levelGenerator.js` — the loop (`generateLevel`, `directedAttempt`,
  `DEFAULT_BOUNDS`, `costModel`, `ATTEMPT`/`STOP`/`KEEP_POLICY`/`KEPT_KIND`,
  `VERDICT`) and the trace/summary contract.
- `templateContract.js` — `defineTemplate` (schema check + parameter draw +
  instance label), `enumerateValues`, `enumerateInstantiations`, and the ONE
  reconstruction `instantiateKept`.
- `procgenRng.js` — `ProcgenRng`: `pick`/`shuffle`/`nextInt`/`next`/`draws`/
  `state` over an **injected source**. There is no default source; a default
  would make this directory import from a substrate.

⛔ **THE LAW: these files import nothing.** The level model, the oracle and the
palette are injected; the bindings are where the imports live. Two of them
exist — `seedlingDemo/procgenSeedling.js` and `mazeRoom/procgenMaze.js` — and
each also supplies its own rng source (`seedlingDemo/procgenRng.js`,
`mazeRoom/procgenRng.js`).

Intent: promoted to `frontend/modules/shared/` when it settles (⚖ CONSTRUCTIVE
-MODE kickoff ruling 4 — *"we can leave the loop core in the outer repo until
we decide to move it into shared"*). Design record:
`NewDocs/plans/seedling-constructive-mode-kickoff.md` §3.2 and §9.
Tracked docs: `docs/json/developer/procgen/seedling-bot.md`, `maze.md`.
