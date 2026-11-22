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
- `tools/judge.mjs` — the rules/owl-executor game judge, re-pointed: model replay from the tape's OWN staging
  (`tapeRunner.stagingFromTape`) with the TB fight on, `SEEDLING_DEMO_DIR` for the model, and `gameStreamMd5` (md5 of
  the game's per-tick `t,x,y,level`). `SEEDLING_PAGE` picks the build.
- `tapes/A/` — the plans under the p4h model (`DET_TB=pat=halton`, scratch copy), switch ON: Spear and Sword, each
  arrival × two seeds (the plan is the same on both). `tapes/shipped/` — the Spear plans under the tracked
  (shipped-RNG) model, switch ON, for the seeds that solved.
- `logs/judge-p4h-A.json` — the six Spear A-tapes on `seedling_bot_ap_p4h` (seedling-wasm `p4h-main` @a335206).
  `logs/judge-p4h-A-round1.json` — the first round (6 Spear + 2 Sword door controls); its `model` column is the OLD
  judge's replay, which built the run without the seam and diverges at t12 — ignore that column there.
- `logs/judge-p4g-shipped.json` — the four shipped-RNG Spear plans on `seedling_bot_ap_p4g`.
  `logs/judge-p4g-A.json` — three A-plans on p4g (the shipped draws: expected to fail).
- `logs/det-A-on.json`, `logs/shipped-on.json`, `logs/on-v1*.json` — the solver ON (A model / tracked model).
