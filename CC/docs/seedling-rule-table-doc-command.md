# Seedling derived-rule table: doc page + refresh command (slice rule-table-doc-command)

Session `rule-table-doc-command` (Opus), launched and reviewed by `seedling-js-planning-21`. ⚖ Licence: Robert,
2026-11-17, "Rule-table doc + command (Recommended)": one doc page and one command, plus their tests and docs plumbing.
The table's content, the probe, the certifier, the engine closure, the producers' logic and the workflows are unchanged.

## Summary for Robert

The derived-rule table (the Seedling rules that the maze certifier derives from the tiles, which override the composed
rules) now has its own doc page and a single command to refresh it. Before this slice, a refresh was four manual steps
that sessions often skipped, which left the table stale between slices. The new command:

- `--check`: checks offline whether the committed table is still fresh;
- `--dispatch`: runs the CI probe, waits for it, fetches the result, copies it in, reruns the producer chain and checks
  the counts;
- `--run=<id>`: does the same from a CI run that has already finished.

It never commits or pushes. If any rule in the table changes, it says so in capitals: a change like that needs the
designer's review.

The proof used no new compute. The command fetched the CI run that the committed table came from (44144131685) and
reproduced the committed table **byte for byte**. The full producer chain then ran over it and changed nothing in the
tree.

## What was added

| File | What |
|---|---|
| `scripts/procgen/refresh-seedling-derived-rules.mjs` | The command (modes below). Its pure parts are exported for tests. It loads the probe and the table modules with `await import`, so the instruments index does not list their flags (`--shards`, `--levels`, `--out`, `--print-engine-closure`) as this command's. |
| `scripts/procgen/refreshSeedlingDerivedRules.test.js` | 18 tests on fixtures, with no network: argument parsing, run selection by headSha + created-after (a newest run at another SHA, an earlier run at the same SHA, clock skew, two matches refused, a push run ignored), the SHA gate, the verdict diff, and the `--check` / `--run` reports and exits. One test also reads `seedling-probe.yml` to confirm the artifact name. |
| `docs/json/developer/procgen/seedling-derived-rules.md` | The doc page: what the table is, where it sits in the chain, the three guards with file:line, staleness and how to read a STALE line, the command and its modes, the count pin, and "a rules fix on an overridden element changes the derivation's INPUT". The name is `seedling-derived-rules.md`: the tracked docs have no step map that would want a different name. |
| `scripts/procgen/seedlingDerivedRuleTable.js` | `REGEN_RECIPE` now names the command first. Step (3) by hand is now the whole chain (`regen-seedling.mjs --write`, which still starts with `make-seedling-playthrough-rules.mjs`). Before, it named only the rules and maze producers, which would leave `world`, `seed1`, `er` and `sphere-order` stale. This file is not in the engine closure (measured: none of the 42 closure files is under `scripts/procgen/`). |
| `scripts/procgen/derivedRuleTableFresh.test.js` | A fifth pin: `REGEN_RECIPE` names `refresh-seedling-derived-rules.mjs --dispatch`. The four existing pins are unchanged and still pass. |
| Links | `maze.md` (its derived-rule-table bullet) and `pipeline-presets.md` (whose line "it will get its own refresh command" now names the command) both link to the page. `seedling-bot.md` and `architecture.md` describe no rule-analysis step, so neither got a link. `architecture.md` changed only in its GENERATED instruments region. |
| Generated | `README_ORDER` gets the page, after `seedling-constants.md`. `generate-procgen-reference.mjs`: 558 instruments, 0 findings, `--check` ALL 7 MODULES AND 5 REGIONS MATCH. `scripts/quicklaunch/generate-docs-index.mjs` was rerun. |

### Pins that moved (by measurement)

- `frontend/modules/procgenDocs/docLinks.test.js` corpus census: 437 → 443 (`doc` 329 → 334, `same-doc` 42 → 43). The
  five new `doc` links are the README index row, the page's links to maze.md and to pipeline-presets.md § Regenerating
  the Seedling playthrough chain, and maze.md's and pipeline-presets.md's links to the page. The one new `same-doc` link
  is the page's link to its own § Staleness. The "sends every sibling .md to the VIEWER" pin also moved, 329 → 334.
- `frontend/modules/procgenDocs/docsRender.test.js`: 437 → 443.
- `scripts/procgen/derivedRuleOverride.test.js:102` matches `regenerate: run alone`. This is a fifth wording pin that
  the brief did not list. The recipe was worded to keep it true (it still starts `run alone.`), so the pin itself did
  not change.

## The command's modes

```
node scripts/procgen/refresh-seedling-derived-rules.mjs --check                     # offline (the default)
node scripts/procgen/refresh-seedling-derived-rules.mjs --dispatch --ref=<branch>   # [--wait-max=<min>] [--no-chain]
node scripts/procgen/refresh-seedling-derived-rules.mjs --run=<id>                  # [--allow-sha-mismatch=<reason>] [--no-chain]
```

- `--check`: runs `tableStaleness` on the committed table, and compares its counts with `expected.summary.table` and
  with the table's own `counts` block. When stale or off count it exits 1, names the md5 that moved, and prints
  `--dispatch --ref=<current branch>`.
- `--dispatch`: refuses unless `origin/<ref>` is the local HEAD. Then it dispatches the probe, finds the
  `workflow_dispatch` run at that SHA created after the dispatch (it refuses if two match), waits, and continues as
  `--run`.
- `--run=<id>`: checks that the run is a seedling-probe run and has completed. Refuses on a headSha ≠ HEAD unless
  `--allow-sha-mismatch=<reason>` is given (the reason is printed). Then it downloads `probe-seedling-derived-rules-log`,
  copies `seedling-playthrough-derived-rules.json` over the committed table, runs `regen-seedling.mjs --write`, holds
  `derived-rules.json`'s SUMMARY against the pin, and recomputes staleness. It prints ONE summary.
- Exit codes: 0 means OK; 1 means stale, drifted, or a chain step failed; 2 means refused.

⚠ **A correction to the brief.** The file the command copies over the committed table is the artifact's
`seedling-playthrough-derived-rules.json`, as REGEN_RECIPE says. The brief said to copy `derived-rules.json`, but that
file is the probe's full labelled row dump. The command reads it only for the count check (its `summary`).

## Proof

**`--check` on main** (tip `1026bb121a` = base `e390574969` + this slice; the table is the same file as at base):

```
table frontend/modules/flashPanel/atlases/seedling-playthrough-derived-rules.json: measuredAt 6707450627; rows 108 / regions 51 / excluded 6
inputs: {"payloadMd5":"e1758771f9de70a1eef3476a65359f70","engineMd5":"bec369878feb67081187edca62baa951","engineFiles":42,"witnessMd5":"2e4e3caad3c894a7e8877f255ae2de56"}
counts vs scripts/procgen/seedling-derived-rules-expected.json summary.table: rows 108=108, regions 51=51, excluded 6=6 OK
staleness: OK (payloadMd5, engineMd5 and witnessMd5 match the tree)
OK: the committed derived-rule table is fresh and on count
exit 0
```

**Mutant:** a scratch copy of the table with `inputs.payloadMd5` set to all zeros, passed through `checkReport`:

```
staleness: STALE — the maze world payloads moved (payloadMd5 00000000000000000000000000000000 → e1758771f9de70a1eef3476a65359f70): the derivation's input changed
STALE: refresh it — node scripts/procgen/refresh-seedling-derived-rules.mjs --dispatch --ref=rule-table-doc-command (then commit the table in the same packet as the change that staled it)
exit 1
```

**Round trip without new compute.** The brief named run 43939520610 (from `f69051752e`). That run is no longer the
source: the committed table was re-recorded since, by `77cb59fc02` ("derived-rule table: CI re-record (REGEN_RECIPE,
seedling-probe 44144131685 at 6707450627)"). So the round trip used **run 44144131685** (headSha `6707450627`,
`workflow_dispatch`, success; its artifact expires 2027-02-15).

`node scripts/procgen/refresh-seedling-derived-rules.mjs --run=44144131685 --allow-sha-mismatch=<reason>` was run with
this reason: *77cb59fc02 records the committed table as this run's artifact (measured at 6707450627); --check at this
HEAD reads its inputs fresh*.

- The table was **BYTE-IDENTICAL** to the committed one: md5 `d4e791946ccf0081e3b3ca9a0be296c7` before and after.
- The chain (`regen-seedling.mjs --write`, 113 s) reported every step OK, and `git status` afterwards showed only this
  slice's untracked file. The chain wrote no diff.
- Every pinned count matched; no verdict moved; staleness OK; exit 0; 1 min 58 s wall in total.

No `--dispatch` was needed, so `--dispatch` has not run against live CI. Its run selection is covered by the unit tests
only (see Residue).

## Gates

- Worktree `/home/robert/CC/Archipelago-CC-wt-rule-table-doc-command`, branch `rule-table-doc-command`. Base: `git
  merge-base HEAD origin/main` = `e390574969c079d9cbe56eb62f0240b120b7470a`. origin/main had not moved at packet time
  (`git merge origin/main`: already up to date), so the gate SHA is the tip. No wasm.
- Bounded vitest (⚖ 52), over every test that imports or names a touched file (`grep -a -l`, slow tier excluded): 26
  files, 566 tests, all green. Plus `argvScan.test.js` (14 tests).
- `check-procgen-help.mjs --only=refresh-seedling-derived-rules.mjs`: PASS, HELP ok · IMPORT ok, run in a throwaway
  tree at `1026bb121`. `--only=probe-seedling-derived-rules.mjs`: PASS.
- `generate-procgen-reference.mjs --check`: ALL 7 GENERATED MODULES AND 5 MARKDOWN REGIONS MATCH THE CODE.
- Identity at the tip: table md5 `d4e79194…` (same as base), engineMd5 `bec369878feb67081187edca62baa951` (42 files),
  `batch-seedling-acceptance.mjs | md5sum` = `391322d681b7aa0229d94b3f6906d024`, closure ∩ diff = ∅, 0 gitlinks,
  0 presets.
- CI at `1026bb121a`:
  - JSUT push run **44341911697** (headSha `1026bb121a`): success. Suite (`ci-vitest-summary.mjs`): vitest (unfiltered)
    28698 passed, 0 skipped, 0 failed; slow battery 438 passed; producer --checks, headless gates and browser gate
    shards all succeeded. Against the base's run 44242476339 at `e390574969` (28679 tests in 1344 files), +F = 0 and +T = 19, with +1 file (the 18 tests in
    `refreshSeedlingDerivedRules.test.js` plus the fifth recipe pin).
  - unittests push run **44341911832** (headSha `1026bb121a`): success.
  - Train-tier dispatch **44341926907** (`train_only=true`, headSha `1026bb121a`): success, all 3 shards, with the
    slowest shard finishing at 1 h 09 min.

## Residue

- `--dispatch` has not run against live CI (the round trip did not need it). The first real refresh will be its first
  live run.
- REGEN_RECIPE's pinned wording still says "before js-16 slots it". The planner is js-21 now, but the phrase is pinned
  by `derivedRuleTableFresh.test.js`, so it was left alone. The command and the doc page say "the planner".
- `--run` keeps the downloaded artifact in `os.tmpdir()/refresh-derived-rules-*` and prints the path. Nothing deletes
  it. (The round trip's copy has been deleted.)
- The worktree is left in place for the cleanup round.
