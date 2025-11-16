#!/usr/bin/env python3
"""Test to understand how rescue items affect abilities."""

from zilliandomizer.options import Options, char_to_gun, char_to_jump, Chars, ID
from zilliandomizer.logic_components.items import items, RESCUE
from zilliandomizer.randomizer import Randomizer
from zilliandomizer.logic_components.locations import Req

# Create a mock randomizer to use make_ability
options = Options()
options.start_char = "JJ"
options.gun_levels = "balanced"
options.jump_levels = "balanced"
options.opas_per_level = 2

# Note: We can't easily create a full randomizer, but we can understand the logic
# from the code in randomizer.py lines 309-341

print("=" * 80)
print("RESCUE ITEMS AND ABILITIES")
print("=" * 80)

print("\nStarting Character: JJ")
print("Settings: balanced gun_levels, balanced jump_levels, 2 opas_per_level")
print()

# Simulate different scenarios
scenarios = [
    ("Start (no items)", []),
    ("After 1 Zillion", [ID.gun]),
    ("After rescuing Champ", ["rescue_champ"]),
    ("After rescuing Apple", ["rescue_apple"]),
    ("After rescuing Champ + 1 Zillion", ["rescue_champ", ID.gun]),
    ("After 2 Opa-Opas", [ID.opa, ID.opa]),
]

for scenario_name, item_codes in scenarios:
    print(f"\n{scenario_name}:")

    # Count items
    zillion_count = sum(1 for i in item_codes if i == ID.gun)
    opa_count = sum(1 for i in item_codes if i == ID.opa)
    has_champ = "rescue_champ" in item_codes
    has_apple = "rescue_apple" in item_codes

    # Calculate level
    level = min(opa_count // options.opas_per_level, options.max_level - 1)

    # Calculate which characters we have
    chars = ["JJ"]
    if has_champ:
        chars.append("Champ")
    if has_apple:
        chars.append("Apple")

    # Calculate gun power (max across all characters)
    gun_powers = []
    for char in chars:
        char_gun_prog = char_to_gun[char][options.gun_levels]
        index = min(zillion_count, len(char_gun_prog) - 1)
        power = char_gun_prog[index]
        gun_powers.append((char, power))

    max_gun = max(p for _, p in gun_powers)

    # Calculate jump power (max across all characters)
    jump_powers = []
    for char in chars:
        char_jump_prog = char_to_jump[char][options.jump_levels]
        index = min(level, len(char_jump_prog) - 1)
        power = char_jump_prog[index]
        jump_powers.append((char, power))

    max_jump = max(p for _, p in jump_powers)

    print(f"  Characters available: {', '.join(chars)}")
    print(f"  Zillion count: {zillion_count}, Opa-Opa count: {opa_count}, Level: {level}")
    print(f"  Gun powers: {', '.join(f'{c}={p}' for c, p in gun_powers)} -> max={max_gun}")
    print(f"  Jump powers: {', '.join(f'{c}={p}' for c, p in jump_powers)} -> max={max_jump}")

print("\n\n" + "=" * 80)
print("KEY INSIGHT: RESCUE ITEMS")
print("=" * 80)
print("""
When you rescue a character (Apple or Champ), you gain access to THEIR abilities!

The game calculates gun and jump power as the MAXIMUM across all characters you have.

Example 1: Start as JJ, rescue Champ
  - JJ has gun progression [1, 2, 2, 3]
  - Champ has gun progression [2, 2, 3]
  - With 0 Zillions: max(JJ=1, Champ=2) = 2
  - Result: You immediately gain gun power 2 without any Zillion items!

Example 2: Start as JJ, rescue Apple
  - JJ has jump progression [1, 2, 2, 2, 3, 3, 3, 3]
  - Apple has jump progression [2, 2, 3, 3, 3, 3, 3, 3]
  - At level 0: max(JJ=1, Apple=2) = 2
  - Result: You immediately gain jump power 2 without any Opa-Opas!

This is crucial for the exporter:
- Locations with gun=2 can be accessed by:
  * JJ/Apple: 1+ Zillion items OR rescuing Champ
  * Champ: immediately (starts with gun=2)

- Locations with jump=2 can be accessed by:
  * JJ: 2+ Opa-Opas OR rescuing Apple
  * Apple: immediately (starts with jump=2)
  * Champ: 6+ Opa-Opas OR rescuing Apple

The exporter needs to generate OR conditions for rescue items!
""")
print("=" * 80)
