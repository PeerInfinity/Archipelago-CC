#!/usr/bin/env python3
"""Test to understand how gun/jump requirements map to items for different characters."""

from zilliandomizer.options import Options, char_to_gun, char_to_jump, Chars

def explain_gun_requirement(req_gun: int, start_char: Chars, gun_levels: str):
    """Explain what items are needed to meet a gun requirement."""
    gun_progression = char_to_gun[start_char][gun_levels]

    print(f"\n  Requirement: gun={req_gun}")
    print(f"  Character: {start_char}, Gun levels: {gun_levels}")
    print(f"  Progression: {gun_progression}")

    # Find minimum Zillions needed
    min_zillions = None
    for i, power in enumerate(gun_progression):
        if power >= req_gun:
            min_zillions = i
            break

    if min_zillions is None:
        print(f"  -> IMPOSSIBLE! Character can't reach gun power {req_gun}")
    elif min_zillions == 0:
        print(f"  -> Accessible from start (character starts with gun power {gun_progression[0]})")
    else:
        print(f"  -> Need {min_zillions}+ Zillion items to reach gun power {req_gun}")

    return min_zillions

def explain_jump_requirement(req_jump: int, start_char: Chars, jump_levels: str, opas_per_level: int):
    """Explain what items are needed to meet a jump requirement."""
    jump_progression = char_to_jump[start_char][jump_levels]

    print(f"\n  Requirement: jump={req_jump}")
    print(f"  Character: {start_char}, Jump levels: {jump_levels}")
    print(f"  Progression (by level): {jump_progression}")

    # Find minimum level needed
    min_level = None
    for i, power in enumerate(jump_progression):
        if power >= req_jump:
            min_level = i
            break

    if min_level is None:
        print(f"  -> IMPOSSIBLE! Character can't reach jump power {req_jump}")
    elif min_level == 0:
        print(f"  -> Accessible from start (character starts with jump power {jump_progression[0]})")
    else:
        min_opas = min_level * opas_per_level
        print(f"  -> Need level {min_level}+ = {min_opas}+ Opa-Opas to reach jump power {req_jump}")

    return min_level

print("=" * 80)
print("ZILLION REQUIREMENT SYSTEM EXPLANATION")
print("=" * 80)

print("\n1. GUN REQUIREMENTS")
print("-" * 80)

print("\nFor a location with gun=2 requirement:")
for char in ["JJ", "Apple", "Champ"]:
    explain_gun_requirement(2, char, "balanced")

print("\nFor a location with gun=3 requirement:")
for char in ["JJ", "Apple", "Champ"]:
    explain_gun_requirement(3, char, "balanced")

print("\n\n2. JUMP REQUIREMENTS")
print("-" * 80)

print("\nFor a location with jump=2 requirement:")
for char in ["JJ", "Apple", "Champ"]:
    explain_jump_requirement(2, char, "balanced", 2)

print("\nFor a location with jump=3 requirement:")
for char in ["JJ", "Apple", "Champ"]:
    explain_jump_requirement(3, char, "balanced", 2)

print("\n\n3. KEY INSIGHTS")
print("-" * 80)
print("""
The zilliandomizer requirement system works as follows:

1. LOCATION REQUIREMENTS (req.gun, req.jump):
   - These are integers representing the POWER LEVEL needed
   - They are set by place_canister_gun_reqs() which RANDOMIZES them per seed
   - gun can be 0, 1, 2, or 3
   - jump can be 0, 1, 2, or 3

2. PLAYER ABILITIES:
   - Gun power is determined by: char_to_gun[character][gun_levels][num_zillions]
   - Jump power is determined by: char_to_jump[character][jump_levels][level]
   - Level is calculated from: level = min(num_opas // opas_per_level, max_level - 1)

3. STARTING ABILITIES:
   - With balanced settings:
     * JJ starts with gun=1, jump=1
     * Apple starts with gun=1, jump=2
     * Champ starts with gun=2, jump=1

4. CONVERTING REQUIREMENTS TO ITEM COUNTS:
   - You must check the character's progression table
   - Find the first index where the power level >= requirement
   - That index is the minimum number of items needed

5. IMPORTANT: Requirements are CHARACTER-DEPENDENT!
   - A gun=2 location needs 1 Zillion for JJ, but 2 Zillions for Apple
   - A jump=2 location needs 2 Opa-Opas for JJ, but 0 for Apple (starts with jump=2)
   - A gun=2 location needs 0 Zillions for Champ (starts with gun=2)

6. IN ARCHIPELAGO:
   - The exporter must account for the start_char option
   - The exporter must use the gun_levels and jump_levels options
   - Different characters will have different access rules for the same location!
""")

print("=" * 80)
