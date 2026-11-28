# rules-l25-wand-arm evidence

- `from-witness/`: copied unchanged from `origin/claude/wand-l25-west-east-nohit-bj2bsw` @a8921e5b89
  (`rules-l25-wand-witness-evidence/plan-l25-26-22-wand.json` and `tapes/l25-26-22-wand.json`). The plan's `plans` and
  `controls` entries are now in `scripts/procgen/seedling-wallflyer-nohit-plans.json`, verbatim.
- `keywalk.py`: the Python key walk (ADD/DEL/CHG per JSON path, atlas-id changes counted apart).
- `runs/keywalk.txt`: that walk over the four presets and the derived-rule table, base vs tip.
- `runs/seed1-cmp.txt`: seed-1 `_Spoiler.txt` and `_sphere_log.jsonl`, base vs tip.
- `runs/regen-write-pass1.log`, `regen-write-pass2.log`, `regen-check.log`: the producer chain.
- `runs/derived-rules-probe.log`: `GITHUB_SHA=6436c7827f node scripts/procgen/probe-seedling-derived-rules.mjs --shards=2`.
- `runs/cert-vanilla.log`, `runs/cert-er.log`: `probe-seedling-whole-game-certify.mjs` (vanilla; `--source=er --arms=new`).
- `runs/derive-check.log`: `derive-seedling-wallflyer-nohit.mjs --check`.
- `runs/probe-wand.log`: `probe-seedling-wallflyer-nohit.mjs --only=l25-26-22-wand,l22-25-21-wand`, played on the game.
- `runs/engine-closure-tip.txt`: `seedlingDerivedRuleTable.js --print-engine-closure` at the tip.
- `runs/vitest-list.txt`, `vitest-default-first-run.txt`, `vitest-slow.txt`: the bounded vitest runs.
