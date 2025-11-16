#!/usr/bin/env python3
"""Test script to examine Zillion location requirements."""

import sys
import os

# Add the Archipelago directory to the path
sys.path.insert(0, os.path.dirname(__file__))

from worlds.zillion import ZillionWorld
from zilliandomizer.options import Options, char_to_gun, char_to_jump
from zilliandomizer.system import System
from zilliandomizer.logic_components.locations import Req

# Create a test world
from random import Random

class MockMultiWorld:
    def __init__(self):
        self.player_name = {1: "TestPlayer"}
        self.seed_name = "TestSeed"
        self.regions = []
        self.early_items = {1: {}}
        self.random = Random(12345)

test_mw = MockMultiWorld()
world = ZillionWorld(test_mw, 1)

# Set up options to match the spoiler file
from worlds.zillion.options import ZillionOptions
world.options = ZillionOptions()
# The spoiler says: start_character: Jj, gun levels: Balanced, jump levels: Balanced
world.options.start_char.value = world.options.start_char.option_jj
world.options.gun_levels.value = world.options.gun_levels.option_balanced
world.options.jump_levels.value = world.options.jump_levels.option_balanced

# Run generate_early to set up the system
world.generate_early()

# Get the zilliandomizer randomizer
zz_r = world.zz_system.randomizer
assert zz_r, "Randomizer not initialized"

# Find the test locations and print their requirements
test_locs = ['B-1 mid far left', 'A-3 top left-center', 'C-3 mid far right', 'H-8 top right-center']

print("Zillion Location Requirements Analysis")
print("=" * 80)
print()
print("Starting character: JJ (gun power 1, jump power 1 at level 0)")
print()
print("Gun power progression for JJ with balanced:")
print("  0 Zillions -> gun 1, 1 Zillion -> gun 2, 2-3 Zillions -> gun 2-3")
print()
print("Jump power progression for JJ with balanced (by level from Opa-Opas):")
print("  level 0 -> jump 1, level 1-3 -> jump 2, level 4-7 -> jump 3")
print()
print("=" * 80)
print()

for loc_name in test_locs:
    # Find the location in the randomizer
    found = False
    for zz_loc in zz_r.locations.values():
        pretty_name = zz_r.loc_name_2_pretty.get(zz_loc.name, zz_loc.name)
        if pretty_name == loc_name:
            req = zz_loc.req
            print(f"Location: {loc_name}")
            print(f"  Internal name: {zz_loc.name}")
            print(f"  Requirements:")
            print(f"    gun: {req.gun}")
            print(f"    jump: {req.jump}")
            print(f"    skill: {req.skill}")
            print(f"    hp: {req.hp}")
            print(f"    red: {req.red}")
            print(f"    floppy: {req.floppy}")
            print(f"    char: {req.char}")
            print(f"    door: {req.door}")
            print(f"    union: {req.union}")
            print()

            # Explain what items are needed
            print(f"  Interpretation:")

            # Gun requirement
            if req.gun == 0:
                print(f"    - gun=0: No gun needed (unusual)")
            elif req.gun == 1:
                print(f"    - gun=1: Starting gun power (JJ/Apple start with 1, Champ with 2)")
            elif req.gun == 2:
                print(f"    - gun=2: Need gun power 2")
                print(f"        JJ: 1+ Zillion items")
                print(f"        Apple: 2+ Zillion items")
                print(f"        Champ: starts with power 2")
            elif req.gun == 3:
                print(f"    - gun=3: Need gun power 3")
                print(f"        JJ: 3+ Zillion items")
                print(f"        Apple: 4+ Zillion items")
                print(f"        Champ: 2+ Zillion items")

            # Jump requirement
            if req.jump == 0:
                print(f"    - jump=0: No jump needed")
            elif req.jump == 1:
                print(f"    - jump=1: Starting jump (all characters at level 0)")
            elif req.jump == 2:
                print(f"    - jump=2: Need level 1+ (2+ Opa-Opas for JJ)")
            elif req.jump == 3:
                print(f"    - jump=3: Need level 4+ (8+ Opa-Opas for JJ)")

            # Other requirements
            if req.red > 0:
                print(f"    - red={req.red}: Need {req.red} Red ID Card(s)")
            if req.floppy > 0:
                print(f"    - floppy={req.floppy}: Need {req.floppy} Floppy Disk(s)")
            if req.skill > 0:
                print(f"    - skill={req.skill}: Skill level requirement")
            if req.door > 0:
                print(f"    - door={req.door}: Need to unlock door {req.door}")
            if req.union:
                print(f"    - union: Has OR requirements (complex)")

            print()
            print("-" * 80)
            print()
            found = True
            break

    if not found:
        print(f"Location '{loc_name}' not found")
        print()
