# seedling-hammer-tb-weapons — evidence

- `tools/tb-arms.mjs` — the rules session's `tb-arms.mjs` (`claude/rules-deterministic-boss-draws-jb2pf9` @0e32a79d2e),
  with ONE fix: a non-sword arm equips ITS OWN slot (`appendInventorySlots(...).indexOf(id)`). The original equipped slot
  0, which in the staged bag `{Fire, Spear}` is the FIRE (`TB_RULES_EQUIP=1` restores that). It also prints each seed
  and the weapons the run pressed. `SEEDLING_DEMO_DIR=seedlingDemo` = the tracked model; default `seedlingDemoDet`.
- `tools/sync-det.sh` + `tools/model-only.diff` — the untracked p4h scratch model: this tree's `seedlingDemo/` plus the
  rules' MODEL hunks only (`finalBossRng.js`, `finalBossFight.js`, `levelRun.js`, `tentacleBeast.js`), NOT its
  solverBot/policy hunks. `DET_TB=pat=halton` selects option A (the p4h patch).
- `logs/base.json` — base (ba36761859), tracked model, shipped RNG, Sword/Spear/Wand, the slot fix on.
- `logs/base-unguarded.json` — base + a TEMPORARY (reverted) resolver edit accepting Spear/Wand, the rules' slot-0
  equip: reproduces the "cadence is 11" refusal, which is the FIRE's.
- `logs/base-unguarded-rightslot.json` — the same temporary edit, the arm's own slot: the sword-tuned policy with the
  Spear and the Wand.
