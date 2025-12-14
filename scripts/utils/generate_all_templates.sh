#!/bin/bash

# Environment variables (with defaults for local usage):
# GENERATE_MULTIWORLD - set to "false" to skip multiworld generation (default: true)
# GENERATE_EXTRA_SEEDS - set to "false" to skip seeds 2 and 3 (default: true)
# GENERATE_WORLDGEN - set to "true" to generate worldgen worlds (default: false)
# WORLDGEN_CANONICAL_SEED1 - set to "true" to use canonical seed 1 placement (default: true)

GENERATE_MULTIWORLD="${GENERATE_MULTIWORLD:-true}"
GENERATE_EXTRA_SEEDS="${GENERATE_EXTRA_SEEDS:-true}"
GENERATE_WORLDGEN="${GENERATE_WORLDGEN:-false}"
WORLDGEN_CANONICAL_SEED1="${WORLDGEN_CANONICAL_SEED1:-true}"

echo "GENERATE_MULTIWORLD: $GENERATE_MULTIWORLD"
echo "GENERATE_EXTRA_SEEDS: $GENERATE_EXTRA_SEEDS"
echo "GENERATE_WORLDGEN: $GENERATE_WORLDGEN"
echo "WORLDGEN_CANONICAL_SEED1: $WORLDGEN_CANONICAL_SEED1"

# Templates with seeds 1, 2, 3
python Generate.py --weights_file_path "Templates/A Link to the Past.yaml" --multi 1 --seed 1
if [ "$GENERATE_EXTRA_SEEDS" = "true" ]; then
  python Generate.py --weights_file_path "Templates/A Link to the Past.yaml" --multi 1 --seed 2
  python Generate.py --weights_file_path "Templates/A Link to the Past.yaml" --multi 1 --seed 3
fi

python Generate.py --weights_file_path "Templates/Adventure.yaml" --multi 1 --seed 1
if [ "$GENERATE_EXTRA_SEEDS" = "true" ]; then
  python Generate.py --weights_file_path "Templates/Adventure.yaml" --multi 1 --seed 2
  python Generate.py --weights_file_path "Templates/Adventure.yaml" --multi 1 --seed 3
fi

python Generate.py --weights_file_path "Templates/A Short Hike.yaml" --multi 1 --seed 1
if [ "$GENERATE_EXTRA_SEEDS" = "true" ]; then
  python Generate.py --weights_file_path "Templates/A Short Hike.yaml" --multi 1 --seed 2
  python Generate.py --weights_file_path "Templates/A Short Hike.yaml" --multi 1 --seed 3
fi

python Generate.py --weights_file_path "Templates/A Hat in Time.yaml" --multi 1 --seed 1
if [ "$GENERATE_EXTRA_SEEDS" = "true" ]; then
  python Generate.py --weights_file_path "Templates/A Hat in Time.yaml" --multi 1 --seed 2
  python Generate.py --weights_file_path "Templates/A Hat in Time.yaml" --multi 1 --seed 3
fi

# Multiworld generation
if [ "$GENERATE_MULTIWORLD" = "true" ]; then
  rm -rf Players/presets/Multiworld/
  mkdir -p Players/presets/Multiworld/
  cp "Players/Templates/A Hat in Time.yaml" "Players/Templates/A Link to the Past.yaml" "Players/Templates/Adventure.yaml" "Players/Templates/A Short Hike.yaml" Players/presets/Multiworld/

  python Generate.py --player_files_path "Players/presets/Multiworld" --seed 1

  if [ "$GENERATE_EXTRA_SEEDS" = "true" ]; then
    python Generate.py --player_files_path "Players/presets/Multiworld" --seed 2
    python Generate.py --player_files_path "Players/presets/Multiworld" --seed 3
  fi

  rm -rf Players/presets/Multiworld/
fi

python Generate.py --weights_file_path "Templates/APQuest.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Aquaria.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Bomb Rush Cyberfunk.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Bumper Stickers.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Castlevania 64.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Castlevania - Circle of the Moon.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Celeste (Open World).yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Celeste 64.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/ChecksFinder.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Choo-Choo Charles.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Civilization VI.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Dark Souls III.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/DLCQuest.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Donkey Kong Country 3.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/DOOM 1993.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/DOOM II.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Factorio.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Faxanadu.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Final Fantasy Mystic Quest.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Heretic.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Hylics 2.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Inscryption.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Jak and Daxter The Precursor Legacy.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Kingdom Hearts.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Kingdom Hearts 2.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Kirby's Dream Land 3.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Landstalker - The Treasures of King Nole.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Lingo.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Links Awakening DX.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Lufia II Ancient Cave.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Mario & Luigi Superstar Saga.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Mega Man 2.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/MegaMan Battle Network 3.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Meritous.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Muse Dash.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Noita.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Old School Runescape.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Overcooked! 2.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Paint.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Pokemon Emerald.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Pokemon Red and Blue.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Raft.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Risk of Rain 2.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Saving Princess.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Secret of Evermore.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/shapez.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Shivers.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/SMZ3.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Sonic Adventure 2 Battle.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Starcraft 2.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Stardew Valley.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Subnautica.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Super Mario 64.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Super Mario Land 2.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Super Mario World.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Super Metroid.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Terraria.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/The Legend of Zelda.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/The Messenger.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/The Wind Waker.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/The Witness.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Timespinner.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/TUNIC.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Undertale.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/VVVVVV.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Wargroove.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Yacht Dice.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Yoshi's Island.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/Yu-Gi-Oh! 2006.yaml" --multi 1 --seed 1

python Generate.py --weights_file_path "Templates/MathProof2p2e4.yaml" --multi 1 --seed 1
if [ "$GENERATE_EXTRA_SEEDS" = "true" ]; then
  python Generate.py --weights_file_path "Templates/MathProof2p2e4.yaml" --multi 1 --seed 2
  python Generate.py --weights_file_path "Templates/MathProof2p2e4.yaml" --multi 1 --seed 3
fi

python Generate.py --weights_file_path "Templates/ChocolateChipCookies.yaml" --multi 1 --seed 1
if [ "$GENERATE_EXTRA_SEEDS" = "true" ]; then
  python Generate.py --weights_file_path "Templates/ChocolateChipCookies.yaml" --multi 1 --seed 2
  python Generate.py --weights_file_path "Templates/ChocolateChipCookies.yaml" --multi 1 --seed 3
fi

python Generate.py --weights_file_path "Templates/WebDevJourney.yaml" --multi 1 --seed 1
if [ "$GENERATE_EXTRA_SEEDS" = "true" ]; then
  python Generate.py --weights_file_path "Templates/WebDevJourney.yaml" --multi 1 --seed 2
  python Generate.py --weights_file_path "Templates/WebDevJourney.yaml" --multi 1 --seed 3
fi

python Generate.py --weights_file_path "Templates/Metamath.yaml" --multi 1 --seed 1
if [ "$GENERATE_EXTRA_SEEDS" = "true" ]; then
  python Generate.py --weights_file_path "Templates/Metamath.yaml" --multi 1 --seed 2
  python Generate.py --weights_file_path "Templates/Metamath.yaml" --multi 1 --seed 3
fi

#python scripts/build/pack_apworld.py metamath
#python scripts/build/pack_apworld.py mathadventure
#python scripts/build/pack_apworld.py bakingadventure
#python scripts/build/pack_apworld.py codingadventure

# TOEM test templates
python Generate.py --weights_file_path "Templates/TOEM original.yaml" --multi 1 --seed 1
python Generate.py --weights_file_path "Templates/TOEM rule builder.yaml" --multi 1 --seed 1

# WorldGen world generation
# Generate worldgen worlds for all standard templates (excluding those in template-exclude-list.json)
if [ "$GENERATE_WORLDGEN" = "true" ]; then
  echo ""
  echo "===== Generating WorldGen worlds ====="
  echo ""

  # Build the canonical-seed1 flag if enabled
  CANONICAL_FLAG=""
  if [ "$WORLDGEN_CANONICAL_SEED1" = "true" ]; then
    CANONICAL_FLAG="--canonical-seed1"
  fi

  # Generate worldgen worlds for all standard templates (alphabetical order)
  # Excluded templates: Archipelago, Final Fantasy, Hollow Knight, Ocarina of Time, Sudoku, Universal Tracker, Zillion
  python scripts/test/test-world-generator.py --include-list "A Hat in Time.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "A Link to the Past.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "A Short Hike.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Adventure.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "APQuest.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Aquaria.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Bomb Rush Cyberfunk.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Bumper Stickers.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Castlevania - Circle of the Moon.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Castlevania 64.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Celeste (Open World).yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Celeste 64.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "ChecksFinder.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Choo-Choo Charles.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Civilization VI.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Dark Souls III.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "DLCQuest.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Donkey Kong Country 3.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "DOOM 1993.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "DOOM II.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Factorio.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Faxanadu.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Final Fantasy Mystic Quest.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Heretic.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Hylics 2.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Inscryption.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Jak and Daxter The Precursor Legacy.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Kingdom Hearts 2.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Kingdom Hearts.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Kirby's Dream Land 3.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Landstalker - The Treasures of King Nole.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Lingo.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Links Awakening DX.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Lufia II Ancient Cave.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Mario & Luigi Superstar Saga.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Mega Man 2.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "MegaMan Battle Network 3.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Meritous.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Muse Dash.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Noita.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Old School Runescape.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Overcooked! 2.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Paint.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Pokemon Emerald.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Pokemon Red and Blue.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Raft.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Risk of Rain 2.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Saving Princess.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Secret of Evermore.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "shapez.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Shivers.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "SMZ3.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Sonic Adventure 2 Battle.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Starcraft 2.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Stardew Valley.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Subnautica.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Super Mario 64.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Super Mario Land 2.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Super Mario World.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Super Metroid.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Terraria.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "The Legend of Zelda.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "The Messenger.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "The Wind Waker.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "The Witness.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Timespinner.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "TUNIC.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Undertale.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "VVVVVV.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Wargroove.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Yacht Dice.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Yoshi's Island.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Yu-Gi-Oh! 2006.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG

  # Custom templates
  python scripts/test/test-world-generator.py --include-list "TOEM original.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "TOEM rule builder.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG

  python scripts/test/test-world-generator.py --include-list "ChocolateChipCookies.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "MathProof2p2e4.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "Metamath.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG
  python scripts/test/test-world-generator.py --include-list "WebDevJourney.yaml" --phase generate-test-worlds --seed 1 $CANONICAL_FLAG

  # Regenerate templates to include the worldgen worlds
  echo ""
  echo "===== Regenerating templates ====="
  echo ""
  python -c "from Options import generate_yaml_templates; generate_yaml_templates('Players/Templates')"

  # Generate presets for worldgen templates (alphabetical order)
  echo ""
  echo "===== Generating presets for WorldGen templates ====="
  echo ""
  python Generate.py --weights_file_path "Templates/A Hat in Time WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/A Link to the Past WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/A Short Hike WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Adventure WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/APQuest WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Aquaria WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Bomb Rush Cyberfunk WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Bumper Stickers WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Castlevania - Circle of the Moon WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Castlevania 64 WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Celeste (Open World) WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Celeste 64 WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/ChecksFinder WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Choo-Choo Charles WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Civilization VI WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Dark Souls III WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/DLCQuest WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Donkey Kong Country 3 WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/DOOM 1993 WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/DOOM II WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Factorio WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Faxanadu WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Final Fantasy Mystic Quest WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Heretic WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Hylics 2 WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Inscryption WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Jak and Daxter The Precursor Legacy WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Kingdom Hearts 2 WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Kingdom Hearts WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Kirby's Dream Land 3 WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Landstalker - The Treasures of King Nole WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Lingo WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Links Awakening DX WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Lufia II Ancient Cave WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Mario & Luigi Superstar Saga WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Mega Man 2 WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/MegaMan Battle Network 3 WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Meritous WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Muse Dash WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Noita WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Old School Runescape WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Overcooked! 2 WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Paint WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Pokemon Emerald WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Pokemon Red and Blue WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Raft WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Risk of Rain 2 WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Saving Princess WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Secret of Evermore WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/shapez WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Shivers WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/SMZ3 WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Sonic Adventure 2 Battle WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Starcraft 2 WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Stardew Valley WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Subnautica WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Super Mario 64 WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Super Mario Land 2 WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Super Mario World WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Super Metroid WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Terraria WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/The Legend of Zelda WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/The Messenger WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/The Wind Waker WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/The Witness WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Timespinner WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/TUNIC WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Undertale WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/VVVVVV WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Wargroove WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Yacht Dice WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Yoshi's Island WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Yu-Gi-Oh! 2006 WorldGen.yaml" --multi 1 --seed 1

  # Custom templates
  python Generate.py --weights_file_path "Templates/TOEM original WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/TOEM rule builder WorldGen.yaml" --multi 1 --seed 1

  python Generate.py --weights_file_path "Templates/ChocolateChipCookies WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/MathProof2p2e4 WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/Metamath WorldGen.yaml" --multi 1 --seed 1
  python Generate.py --weights_file_path "Templates/WebDevJourney WorldGen.yaml" --multi 1 --seed 1
fi

#remove empty preset directories
find frontend/presets -type d -empty -delete

#cp -r frontend/modules/shared frontend/modules/textAdventure-remote/
