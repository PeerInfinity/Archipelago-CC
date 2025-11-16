#!/usr/bin/env python3
"""Test script to examine Zillion location requirements directly."""

from zilliandomizer.options import Options, char_to_gun, char_to_jump
from zilliandomizer.system import System

# Create a system with JJ start character and balanced settings
options = Options()
options.start_char = "JJ"
options.gun_levels = "balanced"
options.jump_levels = "balanced"
options.map_gen = "none"  # Use vanilla map (no random generation)

system = System()
system.set_options(options)
system.seed(12345)  # Same seed for consistency
system.make_map()
system.make_randomizer()

zz_r = system.randomizer
assert zz_r, "Randomizer not initialized"

# Place gun requirements (this sets up the actual location requirements)
zz_r.place_canister_gun_reqs()

# Test locations
test_locs = ['B-1 mid far left', 'A-3 top left-center', 'C-3 mid far right', 'H-8 top right-center']

print("Zillion Location Requirements Analysis")
print("=" * 80)
print()
print("Starting character: JJ (gun power 1, jump power 1 at level 0)")
print()
print("Gun power progression for JJ with balanced:")
jj_guns = char_to_gun['JJ']['balanced']
for i, gun in enumerate(jj_guns):
    print(f"  {i} Zillion items -> gun power {gun}")
print()
print("Jump power progression for JJ with balanced (by level from Opa-Opas):")
jj_jumps = char_to_jump['JJ']['balanced']
for i, jump in enumerate(jj_jumps):
    opas = i * options.opas_per_level
    print(f"  level {i} ({opas} Opa-Opas) -> jump power {jump}")
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
            print(f"  Interpretation for JJ with balanced settings:")

            # Gun requirement
            if req.gun == 0:
                print(f"    - gun=0: No gun needed")
            elif req.gun == 1:
                print(f"    - gun=1: Starting gun power (0 Zillion items needed)")
            elif req.gun == 2:
                print(f"    - gun=2: Need gun power 2 (1+ Zillion items)")
            elif req.gun == 3:
                print(f"    - gun=3: Need gun power 3 (3+ Zillion items)")

            # Jump requirement
            if req.jump == 0:
                print(f"    - jump=0: No jump needed")
            elif req.jump == 1:
                print(f"    - jump=1: Starting jump (0 Opa-Opas needed)")
            elif req.jump == 2:
                print(f"    - jump=2: Need level 1+ (2+ Opa-Opas)")
            elif req.jump == 3:
                print(f"    - jump=3: Need level 4+ (8+ Opa-Opas)")

            # Other requirements
            if req.red > 0:
                print(f"    - red={req.red}: Need {req.red} Red ID Card(s)")
            if req.floppy > 0:
                print(f"    - floppy={req.floppy}: Need {req.floppy} Floppy Disk(s)")
            if req.skill > 0:
                print(f"    - skill={req.skill}: Skill level requirement")
            if req.door > 0:
                print(f"    - door={req.door}: Need to unlock door {req.door} (collect 4 keywords in that room)")
            if req.union:
                print(f"    - union: Has OR requirements")
                if req.union:
                    for i, u in enumerate(req.union):
                        print(f"      OR option {i+1}: gun={u.gun}, jump={u.jump}, char={u.char}")

            print()
            print("-" * 80)
            print()
            found = True
            break

    if not found:
        print(f"Location '{loc_name}' not found")
        print()
