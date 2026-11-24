# Cloud slice `seedling-regen-chain`: one command for the Seedling producer chain

Branch `claude/seedling-regen-chain-command-y2p5fp`. The harness pinned this branch name, so the brief's
`seedling-regen-chain` was not used. Base `origin/main` = **`d3f74f4978`** (`train: unbounded-grid-s2 56888ee976`).
Launcher: js-21. Ruling: ⚖ Robert 2026-11-17T21:42:18Z, *"Regen-chain command (Recommended)"*.

## Summary for Robert

`node scripts/procgen/regen-seedling.mjs` now runs the Seedling playthrough's ten producer steps in the order
recorded in `d416af4243`. That is the 8 steps from the step map, plus the template and the host settings, which run
before seed 1. It has `--check` (the default), `--write`, `--list`, `--from=` and `--only=`. The steps are one data
table in the script. The world step and the seed-1 game, template name and preset key come from
`worldgen-package-recipes.json`. The seed-1 id comes from `seed_utils.get_seed_id(1)`.

At base, `--check` is **OK on all 10 steps (61–63 s)**. `--write` reproduces main exactly: afterwards
`git status --short` shows nothing but the new script, and every md5 matches the L99 report's values. No producer was
edited and nothing was re-recorded. There is one new default-tier vitest file and one new docs section. No workflow
changed and no new CI job was added.

## The step table as built (`--list`)

| # | id | write (the producer's own command) | check | writes |
|---|---|---|---|---|
| 1 | `rules` | `node scripts/procgen/make-seedling-playthrough-rules.mjs` | its `--check` (refuses a stale derived-rule table) | `atlases/seedling-playthrough.json`, `seedling_playthrough/AP_1/AP_1_rules.json` |
| 2 | `partition` | `make-seedling-subregion-partition.mjs` | its `--check` | `atlases/seedling-subregion-partition.json` |
| 3 | `world` | `world_generator_command(...)` from `scripts/lib/worldgen_recipe.py` over the recipe row | `check-worldgen-package-freshness.py seedling_playthrough` | `worlds/seedling_playthrough/` |
| 4 | `template` | `generate_yaml_templates('Players/Templates')` | **none of its own**: regenerated into a temp dir and byte-compared | `Players/Templates/Seedling Playthrough.yaml` (gitignored) |
| 5 | `host-settings` | `update_host_settings.py minimal-spoilers` | **none of its own** and no product to regenerate: reads `host.yaml` against the script's own `PRESETS['minimal-spoilers']` | `host.yaml` (gitignored) |
| 6 | `seed1` | `Generate.py --weights_file_path "Templates/Seedling Playthrough.yaml" --multi 1 --seed 1` | **none of its own**: see below | the 4 files under `seedling_playthrough/AP_14089154938208861744/` + the `preset_files.json` row |
| 7 | `maze` | `make-seedling-playthrough-maze.mjs` | its `--check` | `seedling_playthrough_maze/AP_1/AP_1_rules.json` |
| 8 | `er` | `make-seedling-er-preset.mjs` | its `--check` | `seedling_er/AP_1/AP_1_rules.json` |
| 9 | `sphere-order` | `make-seedling-sphere-order.mjs` | its `--check` | `atlases/seedling-sphere-order.json` |
| 10 | `census` | none: a check only | `census-seedling-campaign.mjs --check-frontier --no-write` | nothing (`--no-write` keeps its `.cache` fix list unwritten) |

How `seed1` is checked. `Generate.py` has no switch for its output directory: `exporter.py` writes to
`local_path('frontend','presets')`. So the chain snapshots the four committed files and `preset_files.json`, then
**deletes** the four files, so a run that writes nothing cannot pass. It then runs `Generate.py` in place and requires:
- all four files exist again;
- `preset_files.json` changed no other game's row;
- the `seedling_playthrough/AP_14089154938208861744` row exists and has `seed: 1`.

After that it byte-compares and puts the snapshot back, whatever the outcome (`try/finally`). This covers the three
traps in the brief: the dirtied `preset_files.json`, a false PASS on the seed field (the row is regenerated, not
kept), and a revert that drops the row (the snapshot is restored byte for byte, never `git checkout`). Every
`output/` file the run created is removed, and so is `output/` if this run created it.

In `--write` the same step keeps what the exporter wrote, restores the final newline `Generate.py` drops, and
restores the snapshot if any of those conditions fails.

Verdict classification: a `STALE derived-rule table: …` line is `REFUSED`, quoted up to its long `— regenerate:`
recipe. Otherwise exit 0 is `OK`, and `SKIP` rows are counted, not hidden. A non-zero exit with `ERROR`/`FAIL` lines
is `STALE` (or `FAILED` under `--write`). Any other non-zero exit is `REFUSED: exit N: <last line>`. In `--write`, a
producer that wrote but warned about a stale table prints `WROTE: ⚠ WARN STALE derived-rule table: …` and the chain
exits 1. The rules producer only refuses under `--check`. In `--write` mode a hard failure stops the chain and
prints the later steps as `SKIPPED: <step> did not write`. Each step's full output is saved in
`.cache/regen-seedling/<step>.<mode>.log`.

Python steps print `python = /home/user/Archipelago-CC/.venv/bin/python` (or `python3` when there is no `.venv`).

## `--check` at base (`d3f74f4978` + the new script), full output

```
regen-seedling --check: 10 step(s); python = /home/user/Archipelago-CC/.venv/bin/python; logs in .cache/regen-seedling/
rules          OK [11.2s]
partition      OK [3.5s]
world          OK [0.6s]
template       OK: Players/Templates/Seedling Playthrough.yaml matches a fresh build [3.1s]
host-settings  OK [0.1s]
seed1          OK: 4 files + the seedling_playthrough row match a fresh build [3.1s]
maze           OK [18.2s]
er             OK [21.7s]
sphere-order   OK [0.0s]
census         OK: (2 SKIP row(s) in its output) [1.6s]
total 63.1s — every step OK
```

At the branch tip (`714b739f`, with the census wording tidied):

```
rules          OK [10.5s]
partition      OK [3.2s]
world          OK [0.6s]
template       OK: Players/Templates/Seedling Playthrough.yaml matches a fresh build [3.4s]
host-settings  OK [0.1s]
seed1          OK: 4 files + the seedling_playthrough row match a fresh build [3.2s]
maze           OK [17.1s]
er             OK [21.6s]
sphere-order   OK [0.0s]
census         OK: 2 SKIP row(s) in its output [1.4s]
total 61.0s — every step OK
```

The two census SKIP rows are `coverage.route-only` and `coverage.full`. The surveys under `.cache/seedling-survey/`
are not on disk in a cloud box. These are the same SKIPs every earlier report shows, and all 15 PASS rows pass.

## `--write` at base, full output

```
regen-seedling --write: 10 step(s); python = /home/user/Archipelago-CC/.venv/bin/python; logs in .cache/regen-seedling/
rules          WROTE [11.5s]
partition      WROTE [3.2s]
world          WROTE [0.7s]
template       WROTE [3.2s]
host-settings  WROTE [0.1s]
seed1          WROTE: byte-identical to before [3.1s]
maze           WROTE [18.0s]
er             WROTE [21.1s]
sphere-order   WROTE [0.0s]
census         CHECKED: no producer; its check is OK (2 SKIP row(s) in its output) [1.6s]
total 62.7s — every step OK

git status --short:
?? scripts/procgen/regen-seedling.mjs

md5 of the committed artifacts these steps write (M = differs from HEAD):
  28dc5dc7b2eccf756d5d59fed66a9bf9    frontend/modules/flashPanel/atlases/seedling-playthrough.json
  858fa745a1677e91bedd7b5060cf7374    frontend/presets/seedling_playthrough/AP_1/AP_1_rules.json
  411078c645e9d34bbd8c6c63e7605ed3    frontend/modules/flashPanel/atlases/seedling-subregion-partition.json
  1b17f2efe5cd75081aba7aab28cc76a0    worlds/seedling_playthrough/Items.py
  cdf0b96b1ed6a20cae0236f95f31431c    worlds/seedling_playthrough/Locations.py
  336c1aa2edf2ad7763d3a8322d11c5f5    worlds/seedling_playthrough/Options.py
  c6416178f4919b50303f5fff444682fc    worlds/seedling_playthrough/Regions.py
  c84ac1c97b4d27f062c500803079afd6    worlds/seedling_playthrough/Rules.py
  43a072161ddb56bac218e8f2f14189df    worlds/seedling_playthrough/__init__.py
  33f88919b8bbcfc24cc7594b8212f28a    worlds/seedling_playthrough/_ext/__init__.py
  89052f0454ab87609e59416a37a166d7    worlds/seedling_playthrough/_ext/_game.py
  4ab6afeafe0e88222f4aa97e19f018b6    worlds/seedling_playthrough/_ext/extra_rules.py
  5654276f4bd9008852733c9984ab6b22    worlds/seedling_playthrough/_ext/world_mixin.py
  c7349876715b4b12165c3a98ec518e77    worlds/seedling_playthrough/_spoiler_hook_client.py
  718e53d0a07beea32341e99b70dafbce    worlds/seedling_playthrough/_worldgen_flash_panel.json
  8eefdac938bbe500af19de442dd2d1c8    worlds/seedling_playthrough/_worldgen_options.json
  2aee88bf21fc1af290298d3133537192    worlds/seedling_playthrough/_worldgen_region_atlas.json
  1f73b3d73ad086f122a1deda099857b1    worlds/seedling_playthrough/_worldgen_rules.json
  4db1f1dae654228a3a258d582db54888    worlds/seedling_playthrough/_worldgen_sidecars.json
  54b1285b58e33842e810bf0f3f4a9531    worlds/seedling_playthrough/archipelago.json
  d5e3a62f2954b5243b13698daa812ab4    worlds/seedling_playthrough/docs/en_Seedling Playthrough.md
  5fb134be656a9ad523d41a28e72698d7    worlds/seedling_playthrough/docs/setup_en.md
  2c209272c5fab024ce52f30ce66899da    frontend/presets/seedling_playthrough/AP_14089154938208861744/AP_14089154938208861744.archipelago
  39ca6d69dc29167ad2a80338c391065c    frontend/presets/seedling_playthrough/AP_14089154938208861744/AP_14089154938208861744_Spoiler.txt
  58b2d639b943e901c1cfe0f507bd6367    frontend/presets/seedling_playthrough/AP_14089154938208861744/AP_14089154938208861744_rules.json
  efaa192138acaa62745b86477345bc04    frontend/presets/seedling_playthrough/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl
  d9a6424e62f167d7429e7aae385a591f    frontend/presets/preset_files.json
  68731263d45faeea0a1aa8a1908312d7    frontend/presets/seedling_playthrough_maze/AP_1/AP_1_rules.json
  aa6c0885cc996bc7c3336b4e01cfa19c    frontend/presets/seedling_er/AP_1/AP_1_rules.json
  4a9b7e8061aa23fda3048547f9dd78b3    frontend/modules/flashPanel/atlases/seedling-sphere-order.json
```

**`git status --short` is empty apart from the uncommitted script itself, so main reproduces itself.** The md5s agree
with the L99 report's after-values: atlas `28dc5dc7`, AP_1 `858fa745`, sphere log `efaa1921`, `.archipelago`
`2c209272`, Spoiler `39ca6d69`, maze `68731263`, ER `aa6c0885` and sphere order `4a9b7e80`. Ignored-file side effects
were `__pycache__/` under `worlds/seedling_playthrough/` and the chain's own `.cache/regen-seedling/` logs. Both are
gitignored. `output/` was removed because this run created it.

## Per-step timings (s)

| step | `--check` base | `--check` tip | `--write` base |
|---|---|---|---|
| rules | 11.2 | 10.5 | 11.5 |
| partition | 3.5 | 3.2 | 3.2 |
| world | 0.6 | 0.6 | 0.7 |
| template | 3.1 | 3.4 | 3.2 |
| host-settings | 0.1 | 0.1 | 0.1 |
| seed1 | 3.1 | 3.2 | 3.1 |
| maze | 18.2 | 17.1 | 18.0 |
| er | 21.7 | 21.6 | 21.1 |
| sphere-order | 0.0 | 0.0 | 0.0 |
| census | 1.6 | 1.4 | 1.6 |
| **whole chain** | **63.1** | **61.0** | **62.7** |

## Negative proofs (each one reverted afterwards; the tree was clean after each)

- **STALE.** A newline was appended to the committed seed-1 sphere log, then `--only=seed1` was run:
  `seed1 STALE: differs from a fresh build: frontend/presets/seedling_playthrough/AP_14089154938208861744/AP_14089154938208861744_sphere_log.jsonl [3.3s]`,
  exit 1. The tampered bytes were restored as the snapshot, which proves the restore. `output/` was gone afterwards.
- **REFUSED, by name** (brief step 4). A space was appended to `scripts/procgen/seedling-binding-witnesses.json`, then
  `--only=rules,partition` was run:
  `rules REFUSED: STALE derived-rule table: the binding witness ledger moved (witnessMd5 2e4e3caad3c894a7e8877f255ae2de56 → 0e9b22cd4466671cb25e621c990eac9e, scripts/procgen/seedling-binding-witnesses.json): the sharedBinding re-admissions changed [10.5s]`.
  `partition` was still OK, and the exit was 1.
- Argv: `--only=bogus` prints `regen-seedling: no step "bogus" (the steps: rules, partition, world, template,
  host-settings, seed1, maze, er, sphere-order, census). See --help.` and exits 2.

## Findings at main

None. Every step is OK at `d3f74f4978`, including `rules --check`. The derived-rule table is current at this base:
it is not stale against the maze payloads, the engine closure or the witness ledger.

Two observations. Neither is a defect and neither was fixed here:
1. **`atlas_files.json` is not in the chain.** It is the hand-kept served index that must name a new atlas id
   (`d416af4243`: "it reds until it does"). No producer writes it, so a `--write` that moves the atlas id leaves it to
   be edited by hand. The `rules` step's note and the docs say so. A check row for it would be a new check, which is
   outside this slice.
2. **There is a cycle the chain cannot order away.** `rules --check` judges the derived-rule table against the
   **committed maze preset** (`payloadMd5`), and the maze preset is written by step 7. So in a re-record that moves the
   maze payloads, step 1's check stays `REFUSED` until CI's table lands. `--write` therefore runs `rules` without
   `--check` (the producer only WARNs), prints the warning as `WROTE: ⚠ WARN STALE derived-rule table: …`, and exits 1.
   The unit test pins this as the one backward edge in the table.

No producer needed a flag it lacks. The chain keeps each step's noisy output out of the terminal by sending it to the
step's log, so no `--quiet` was needed.

## Files changed

- `scripts/procgen/regen-seedling.mjs` (new). It follows the instruments' `argvHelp(import.meta.url)` convention
  and runs `main` only when it is the entry point, so importing it does nothing.
- `scripts/procgen/regenSeedling.test.js` (new, default vitest tier, 11 tests, no producer run). It covers:
  - the recipe read;
  - the exact step order;
  - every step has a check, and every command's script exists;
  - the seed-id naming;
  - "no step reads a later step's output, except the derived-rule staleness edge";
  - argv parsing and selection;
  - verdict classification.
- `docs/json/developer/procgen/pipeline-presets.md`: a new section, *Regenerating the Seedling playthrough chain*. It
  gives the order as a table, the commands, and what `--check` and `--write` do. It also says the derived-rule table
  is refreshed by its own command (to come) and the chain only reads it.
- `frontend/modules/flashPanel/atlases/README.md`: one entry naming the chain's products and linking to that section.
  This is where the ordered recipe now lives instead of only in commit messages.
- Regenerated by `generate-procgen-reference.mjs`: `docs/json/developer/procgen/README.md`, `architecture.md`,
  `frontend/modules/procgenDocs/generated/docsIndex.js`, `frontend/modules/procgenDocs/generated/instruments.js`.
- This report.

## Doc pins moved

All of these come from `generate-procgen-reference.mjs`, and `--check` passes afterwards: ALL 7 GENERATED MODULES
AND 5 MARKDOWN REGIONS MATCH THE CODE.
- `architecture.md` § GENERATED:procgen-instruments:
  - instruments **555 → 556** (new prefix `regen-` 1);
  - with flags of their own **472 → 473**;
  - cited by a doc **290 → 293** (the new section cites `regen-seedling.mjs` and producers no doc cited before);
  - `--help` inherited from `argvHelp.js` **552 → 553**.
- `README.md` § GENERATED:procgen-docs-index: **556,968 → 557,337 words**. The Pipeline Presets row changed too.
- `instruments.js` and `docsIndex.js`: the same facts as module data.

## Gates run here

- `check-procgen-help.mjs --in-place --only=regen-seedling.mjs`: `PASS: regen-seedling.mjs — HELP ok (51 ms) · IMPORT ok (43 ms)`.
- `generate-procgen-reference.mjs --check`: all match after the regeneration.
- Bounded vitest (⚖ 52: no unfiltered run). It covered the new test and every test that reads what this slice
  touched: `procgenDocs/` (generated modules, `docLinks`, `docsRender`, glossary, …), `quickLaunch/` (it reads the
  generated modules), `argvHelp.test.js` and `ciDocsOnly.test.js`. Result: **18 files, 639 tests passed**.
- JSUT (the suite) at the push: see the CI note below.

## CI

There is no `gh` CLI in this cloud box. Through the GitHub tools, the JSUT run for the pushed code tip `714b739f69`
is *JavaScript Unit Tests* #6411, https://github.com/PeerInfinity/Archipelago-CC/actions/runs/44184918491. It was
**queued** when this report was written, so I have **no suite number**. Quote it from CI at landing, for example with
`node scripts/procgen/ci-vitest-summary.mjs 714b739f69 --wait`. This report commit changes only the report, so its own
push run tests the same code.
