# The Seedling Derived-Rule Table

The derived-rule table (`frontend/modules/flashPanel/atlases/seedling-playthrough-derived-rules.json`) holds the access rules that the maze worlds derive from Seedling's tiles, for the elements where that derivation is exact. The Seedling Playthrough's rules producers apply it over their own composed rules. CI makes it; the producers only read it. This page covers what is in it, the three guards around it, how to tell when it is stale, and the one command that refreshes it (`scripts/procgen/refresh-seedling-derived-rules.mjs`).

## What the table is

The playthrough's AP rules are **composed** by the rules producer (`make-seedling-playthrough-rules.mjs`) from the atlas, the overlay's hand terms and the event layer. The same atlas is also compiled into maze worlds (`make-seedling-playthrough-maze.mjs`), and the maze certifier (`mazeRoom/tileSpike/certifyPlaythroughMaze.js`) **derives** a rule for each element from the tiles. See [The Maze Substrate](./maze.md) for the certifier and what its agreement proves.

`scripts/procgen/probe-seedling-derived-rules.mjs` runs that certifier over the whole game and labels every element row `derived`, `echoed`, `arrival-dependent`, `path-vs-edge` or `problem` (`tileSpike/derivedRuleRows.js`). The table is the subset that is safe to override with:

- **EXACT** elements only: one fresh arrival, rooted, never walked into from another member, no partial row, echo-free, and a derived rule truth-table EQUAL to the composed one;
- minus every **sharedBinding** element (one whose rule or place the event layer binds), unless every event it names has a game witness in `scripts/procgen/seedling-binding-witnesses.json`;
- minus the probe's named exclusions (`TABLE_EXCLUSIONS`, each with its reason).

Each row is `{key, kind, region, name, arrival, atlas: {region_id, exit_id | location}, rule}`. Each `excluded` entry is `{key, why}`. The `inputs` block records what the table was derived from (see [Staleness](#staleness)).

Both producers apply it after composing (`scripts/procgen/seedlingDerivedRuleTable.js`): first the atlas rows that carry the element's rule (`applyDerivedRuleTableToAtlas`, `seedlingDerivedRuleTable.js:142`), then AP_1 and the maze preset's AP layer (`applyDerivedRuleTable`, `:165`). The maze cannot read an override back: its worlds take the atlas's geometry and the overlay's hand terms only. `derivedRuleOverride.test.js` pins that with a sentinel row.

## Where it sits in the chain

The table is the output of the rule-analysis step and an input of the producer chain. It is **not** one of the chain's steps:

```
maze preset + certifier ──(CI: seedling-probe.yml → probe-seedling-derived-rules.mjs)──▶ derived-rule table
derived-rule table ──▶ rules → partition → world → template → host-settings → seed1 → maze → er → sphere-order → census
```

The chain is `regen-seedling.mjs` ([Pipeline Presets](./pipeline-presets.md#regenerating-the-seedling-playthrough-chain)). Its `rules` step reads the table. When the table is stale, `rules --check` refuses with `STALE derived-rule table: …`, and the chain prints that line as `REFUSED`.

The probe is CI-sized (a 6 GB heap per shard, 4 shards), so it runs on CI through `seedling-probe.yml`, which is dispatched by hand only. Nothing that runs on push regenerates the table.

## The three guards

The guards are stated in `seedlingDerivedRuleTable.js:12-19`. Each one names the element it refuses.

1. **A hand term on a table element is refused** (`refuseHandRowsUnderTable`, `seedlingDerivedRuleTable.js:129`; called at `make-seedling-playthrough-rules.mjs:1193`). A hand term is a row of the overlay's `handExitTerms` / `handLocationTerms`. The table never holds an echo, so a hand row on one of its elements would be a ruling the table silently replaces. A hand ruling there must become an input of the derivation (the overlay), or the element must leave the table.
2. **COMPOSED ≠ TABLE is refused** (`applyDerivedRuleTable` returns `composedDisagrees`; the message is `composedDisagreeMessage`, `:211`). The composition still runs, and its rule is compared with the table's (`compareRules`) before the override. The rules producer collects the disagreements at `make-seedling-playthrough-rules.mjs:3131`, and the maze producer throws on them at `make-seedling-playthrough-maze.mjs:845`. The producers' `--check` holds the count at zero.
3. **Staleness** (`tableStaleness`, `:105`): the table records the md5 of its inputs, and the producers' `--check` (`make-seedling-playthrough-rules.mjs:3167`) and `scripts/procgen/derivedRuleTableFresh.test.js` (default vitest tier, so every push runs it) recompute them. See the next section.

⚠ **A rules fix on an overridden element changes the derivation's INPUT.** If you fix a rule only in the composition (the rules producer's code), the table overwrites the fix, and guard 2 refuses the build because the composed rule no longer equals the table's. Make the fix where the derivation reads it, in the overlay or the grid, and refresh the table. Otherwise take the element out of the table by name (`TABLE_EXCLUSIONS` in the probe, with its reason).

## Staleness

The table's `inputs` block has four fields:

| Field | What it hashes | Moves when |
|---|---|---|
| `payloadMd5` | The committed maze preset's world payloads (`frontend/presets/seedling_playthrough_maze/AP_1/AP_1_rules.json`, `preset_sidecars['1']`) | Any change to a maze world: the atlas, the overlay, the grid, the projection. |
| `engineMd5` | Every file in the static import closure of `certifyPlaythroughMaze.js`, by path and content | Any edit to a closure file, **including a comment-only edit**, and including `shared/` submodule files in the closure. List the closure with `node scripts/procgen/seedlingDerivedRuleTable.js --print-engine-closure`. |
| `engineFiles` | The closure's file count | Informational only; it is not compared. |
| `witnessMd5` | `scripts/procgen/seedling-binding-witnesses.json` | A binding witness is added or removed. |

**Reading a STALE line.** Each line names the field that moved, with the md5 it had and the md5 it has now:

```
STALE derived-rule table: the derivation engine moved (engineMd5 bec36987… → 1a2b3c…, 42 files in the closure of
frontend/modules/mazeRoom/tileSpike/certifyPlaythroughMaze.js; a comment-only edit counts) — regenerate: …
```

- `payloadMd5` moved: a maze world changed. Refresh the table. Its verdicts may move.
- `engineMd5` moved: a file in the certifier's closure changed. Refresh the table. If the edit did not change the logic (a comment or a rename), the refresh moves only `inputs` and `measuredAt`.
- `witnessMd5` moved: the witness ledger changed. Refresh the table. sharedBinding elements may come back into the table.

A stale table is refreshed **in the same packet** as the change that staled it. Do not leave it stale between slices.

## The refresh command

`scripts/procgen/refresh-seedling-derived-rules.mjs` runs the four steps of `REGEN_RECIPE` (`seedlingDerivedRuleTable.js:49`): dispatch, fetch, copy, chain, plus the count check. It never commits and never pushes.

```
node scripts/procgen/refresh-seedling-derived-rules.mjs --check                     # offline (the default)
node scripts/procgen/refresh-seedling-derived-rules.mjs --dispatch --ref=<branch>   # dispatch the probe, wait, then as --run
node scripts/procgen/refresh-seedling-derived-rules.mjs --run=<id>                  # a run that already finished
```

| Mode | What it does |
|---|---|
| `--check` | Offline, with no `gh` call. Runs `tableStaleness` on the committed table, and compares its row, region and exclusion counts with `seedling-derived-rules-expected.json` `summary.table` and with the table's own `counts` block. When stale or off count it exits 1, names the md5 that moved, and prints the exact `--dispatch` command for the current branch. |
| `--dispatch [--ref=<branch>] [--wait-max=<min>]` | Refuses unless `origin/<ref>` is the local HEAD (otherwise the run would measure a different tree). Then runs `gh workflow run seedling-probe.yml -R PeerInfinity/Archipelago-CC --ref <ref> -f probes=probe-seedling-derived-rules.mjs`, and finds **that** run: the `workflow_dispatch` run at the branch's head SHA created after the dispatch. It never takes "the newest run", and it refuses if two runs match. It waits for the run (default 90 min), then continues as `--run`. `--ref` defaults to the current branch. |
| `--run=<id>` | Checks that the run is a `seedling-probe.yml` run and has completed. Refuses unless the run's `headSha` equals the local HEAD. `--allow-sha-mismatch=<reason>` overrides this, for a measured reason only, and the reason is printed. Then it downloads the `probe-seedling-derived-rules-log` artifact, copies its `seedling-playthrough-derived-rules.json` over the committed table, runs `regen-seedling.mjs --write`, holds the artifact's `derived-rules.json` SUMMARY against `seedling-derived-rules-expected.json`, and recomputes staleness. |
| `--no-chain` | With `--dispatch` or `--run`: copy the table and check the counts, but skip `regen-seedling.mjs --write`. |

A `--run` ends with one summary: whether the new table is byte-identical to the committed one, its counts against the pin, every pinned count that drifted, every `inputs` field that moved, every **moved verdict** as `element: old → new`, the chain's result, and staleness OK/STALE. A verdict is the element's rule, its exclusion, or its absence from the table. A moved verdict is a row added, removed or given a different rule, or an exclusion added or removed. A change that moves only `inputs` or `measuredAt` is not a verdict move.

⚠ A red probe run is the normal result of a refresh. The probe fails whenever the table it emits differs from the committed one, so `--run` does not refuse a failed run. It refuses a run whose artifact is missing (a dead shard), or whose table has no `inputs` block (a `--levels` run).

⚖ **When verdicts move, the command prints it in capitals.** In that case the packet owes a tile-primitives designer review before the planner slots it (REGEN_RECIPE's rule). A refresh that moves only `inputs` needs no review.

Exit codes: 0 means everything is OK. 1 means the table is stale, a count drifted, or a chain step failed. 2 means the command refused: bad arguments, a SHA mismatch, no such run or artifact, or a `gh` error.

## The count pin

`scripts/procgen/seedling-derived-rules-expected.json` pins the probe's whole-game SUMMARY: the certifier triple, the echoes, every label count, W0's truth table, the arrival structure, route A, and `table` (`rows` / `regions` / `excluded`). Every leaf it names must equal the probe's measurement (`expectedMismatches`). A slice that moves these counts re-records this file, and its `$comment` says which rows moved and which CI run measured them.

## Files

| File | Role |
|---|---|
| `frontend/modules/flashPanel/atlases/seedling-playthrough-derived-rules.json` | The table (generated; never edited by hand). |
| `scripts/procgen/seedlingDerivedRuleTable.js` | Reads and applies the table, the three guards, `REGEN_RECIPE`, `--print-engine-closure`. |
| `scripts/procgen/probe-seedling-derived-rules.mjs` | The probe that emits the table and `derived-rules.json`, and holds both against the committed files. |
| `.github/workflows/seedling-probe.yml` | The manual CI runner; uploads `probe-seedling-derived-rules-log`. |
| `scripts/procgen/seedling-derived-rules-expected.json` | The count pin. |
| `scripts/procgen/refresh-seedling-derived-rules.mjs` | The refresh command. |
| `scripts/procgen/derivedRuleTableFresh.test.js` | Guard 3 on every push, and the pins on `REGEN_RECIPE`'s wording. |
| `scripts/procgen/derivedRuleOverride.test.js`, `refreshSeedlingDerivedRules.test.js` | The override's unit rows, and the refresh command's. |
