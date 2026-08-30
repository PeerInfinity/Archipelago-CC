# seedling_atlas_sphere

A sphere-grown world with pieces of the **real Seedling map** placed in it
(`CC/docs/plans/region-atlas-plan.md`, Phase 6). It carries the WHOLE starter
atlas — all ten sub-regions — each hanging at the wave its own entry requirement
earns:

- four are free to walk into and ride at wave 0;
- four sit behind the map's `Progressive Sword OR Ghost Spear` crossing. The
  world gates them on that whole **Or**, and the sorter scheduled Ghost Spear
  into sphere 1, so either weapon really opens them and the gate is still a
  proper sphere-1 gate;
- two sit behind `Progressive Swim`, scheduled into sphere 2.

Eight of the eighteen regions hang off an atlas region rather than a generated
one — including a generated region behind the map's own sword-or-spear door,
which is the case where the real map's charge for a crossing IS the gate the
world uses and nothing synthetic is added on top.

Regenerate (deterministic — byte-identical every time, and gated by
`scripts/procgen/verify-atlas-sphere-roundtrip.mjs`). The atlas quota must be at
least the number of regions the sorter accepts (all ten): a smaller one just
truncates in declaration order, which serves nothing.

```
node scripts/procgen/dump-sphere-growth.js --seed 1 --region 8x6 \
    --quota maze=6 --quota atlas:seedling=10 --start maze --fillers 3 \
    --atlas frontend/atlas-pools/seedling-atlas-pool.json \
    -o /tmp/seedling-atlas-sphere-dump.json \
    --rules-out frontend/presets/seedling_atlas_sphere/AP_1/AP_1_rules.json
```

Add `--atlas-placement quota` for the fallback route, where the grower draws
atlas regions like any substrate and gates them with a synthetic gate from the
plan instead.

The in-app leg `seedling-atlas-sphere-placed-region`
(`frontend/modules/tests/testCases/seedlingAtlasMazeTests.js`) walks this preset.
