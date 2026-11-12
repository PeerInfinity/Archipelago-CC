Census of the refusal shape "waypoint N … not reached within K ticks; stalled at … after grazing" (hammer-connected-l22).

On-disk CI artefacts (2026-11-12, not re-run here):
- survey 43263653105 (through-end, 244 steps): 2 rows — step 114 (L58, yeti@56,56) and step 150 (L43, tile:Blue Wall).
  (survey 43263949170: the same 2 rows.)
- divergence sweep 42311570470 (930 rows, 2026-11-06; 42311572827/575652/578595 identical): 2 rows — id 352
  (level_37__r0c18 -> level_38, hermit) and id 704 (level_88 -> level_12__r0c19, tree).
- No L22 row: the sweep's L22 legs hold the Progressive Sword (rows 250/258 solve on the full pass).

Bounded single-step re-runs here (survey-seedling-route.mjs --through=end --only=<step>), switch OFF/ON:
see survey-steps-114-150.json. Step 150 is a hidden death loop (bosstotem@152,168); step 114 is a true stall.
