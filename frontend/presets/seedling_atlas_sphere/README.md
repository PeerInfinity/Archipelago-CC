# seedling_atlas_sphere

A sphere-grown world with pieces of the **real Seedling map** placed in it
(`CC/docs/plans/region-atlas-plan.md`, Phase 6). Generated maze regions carry the
progression; the atlas regions hang off them at the wave their own entry
requirement earns — the three water-locked overworld sub-regions sit behind
`Progressive Swim`, which the sorter scheduled into sphere 1 so the gate is both
the real game's requirement and a proper sphere-1 gate.

Regenerate (deterministic — byte-identical every time, and gated by
`scripts/procgen/verify-atlas-sphere-roundtrip.mjs`):

```
node scripts/procgen/dump-sphere-growth.js --seed 1 --region 8x6 \
    --quota maze=6 --quota atlas:seedling=8 --start maze --fillers 3 \
    --atlas frontend/atlas-pools/seedling-atlas-pool.json \
    -o /tmp/seedling-atlas-sphere-dump.json \
    --rules-out frontend/presets/seedling_atlas_sphere/AP_1/AP_1_rules.json
```

Add `--atlas-placement quota` for the fallback route, where the grower draws
atlas regions like any substrate and gates them with a synthetic gate from the
plan instead.

The in-app leg `seedling-atlas-sphere-placed-region`
(`frontend/modules/tests/testCases/seedlingAtlasMazeTests.js`) walks this preset.
