# Region-atlas sphere-growth pools

One file per game: the **content pool** sphere growth reads when it is asked to
place pre-built regions of a real game inside a world it grows
(`CC/docs/plans/region-atlas-plan.md`, Phase 6).

A pool is **derived, not authored**. It is the Phase-5b maze projection of the
game's atlas, plus — per exit — the atlas's own authored access rule. Rebuild it
with:

```
node scripts/procgen/region-atlas-pool.mjs \
    frontend/modules/flashPanel/atlases/seedling.json \
    -o frontend/atlas-pools/seedling-atlas-pool.json
```

and gate the committed copy with the same command plus `--check` (exact
byte-identical regeneration — the output carries no timestamp). Regenerate it
whenever the atlas, the game's semantics tables, or the projection change; the
`pool_id` ends in a content hash, so a stale pool is loud rather than silent.

To grow a world with one:

```
node scripts/procgen/dump-sphere-growth.js --seed 1 \
    --atlas frontend/atlas-pools/seedling-atlas-pool.json \
    --quota maze=4 --quota atlas:seedling=3 --start maze --fillers 2 \
    -o /tmp/sphere-atlas.json
```

The quota id is `atlas:<game>`; the document itself rides on
`growthParams.substrateConfig['<game>'].atlasDoc`. See
`frontend/modules/procgenPipeline/regionAtlasPool.js` for why this is its own
document kind rather than a region library, and
`frontend/region-libraries/` for the interchangeable-content sibling.
