# frontend/packs: content packs

These are data directories loaded by `frontend/modules/contentPacks/`. They live under `frontend/` because
GitHub Pages serves only `frontend/`.

- `packs.json` is the hand-kept registry. It lists the packs and the named **stacks** a consumer loads, in
  override order (a later pack wins per key). For example, `graphics.seedling = ["seedling", "archipelago"]`
  is what the Seedling JS runtime page's `?graphics=seedling` loads.
- `seedling/` holds the original Seedling graphics: tiles, cliffsides and static scenery (G1), the player (G2),
  the enemies, the arrow and the AP item looks (G3), the wallflyers, drills, turrets, their shots and the
  Bob Boss (G3b), and the spinning axes, crushers, lava chains, the Boss Totem and its shots, the bomb pusher,
  its bombs and the grenades (G3c; the G3, G3b and G3c rows live in
  `frontend/modules/seedlingDemo/seedlingEnemyArt.js`, which the extractor spreads into its table). The art is by
  Connor Ullmann, under the Unlicense (`vendor/seedling/LICENSE`).
- `archipelago/` holds the fork's AP-item pickup (`ArchipelagoLogo.png`), under MIT (see `pack.json`).

⛔ **Both packs are GENERATED. Do not edit them.** Regenerate with
`node scripts/procgen/extract-seedling-art-packs.mjs`, and check with the same command plus `--check`. The sheets
are the `vendor/seedling` PNGs copied byte for byte.

Left out by ruling: the 04B_03 font, the promotional, Newgrounds and tank images, and all music and sound.
