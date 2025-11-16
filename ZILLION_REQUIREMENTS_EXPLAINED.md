# Zillion Requirement System Explained

## Summary

The zilliandomizer library's requirement system is **character-dependent** and **option-dependent**. The current exporter is oversimplified and produces incorrect access rules.

## Answers to Your Questions

### 1. What do the gun levels 0, 1, 2, 3 mean in terms of actual items needed?

**Gun levels are POWER LEVELS, not item counts!** The relationship between gun power and items collected is defined by lookup tables that vary by character and options.

For **JJ with balanced gun_levels**:
- gun=1: 0 Zillion items (starting power)
- gun=2: 1+ Zillion items
- gun=3: 3+ Zillion items

For **Apple with balanced gun_levels**:
- gun=1: 0-1 Zillion items (starting power maintained through 1st upgrade)
- gun=2: 2+ Zillion items
- gun=3: 4+ Zillion items

For **Champ with balanced gun_levels**:
- gun=2: 0+ Zillion items (starts with power 2!)
- gun=3: 2+ Zillion items

**Key insight**: The same `req.gun` value means different item counts for different characters!

### 2. Why does "A-3 top left-center" have jump=1 but is accessible in Sphere 0?

Your test data may have been from a different seed. Requirements are randomized per seed by `place_canister_gun_reqs()`.

When I tested with a random seed and vanilla map, I got:
- "A-3 top left-center": gun=2, jump=1

This would require 1+ Zillion items for JJ, so it would NOT be accessible in Sphere 0.

**The requirements you see depend on the seed!** The exporter must read the actual `zz_loc.req` values for each location in the generated world.

### 3. Why does "C-3 mid far right" have gun=1 but requires Zillion item?

It doesn't! In my test, "C-3 mid far right" had gun=1, jump=0, which is accessible from start for JJ.

Looking at your sphere data, it appears in `new_accessible_locations` in sphere 0.3, but that doesn't mean it REQUIRES a Zillion—it just means it became accessible AFTER getting a Zillion (possibly because other locations blocking access now have their items collected).

The sphere it appears in sphere 1.5 (`sphere_locations`) means that's when the item was COLLECTED, not when it became accessible.

### 4. Do players start with any abilities/items in Zillion that aren't tracked?

**YES! This is critical:**

**Starting abilities depend on the character:**

With balanced settings:
- **JJ**: gun=1, jump=1
- **Apple**: gun=1, jump=2 (better jump!)
- **Champ**: gun=2, jump=1 (better gun!)

These starting abilities are NOT items in the item pool—they're inherent to the character.

**EVEN MORE IMPORTANT: Rescue items boost abilities!**

When you rescue Apple or Champ, you gain access to THEIR abilities. The game uses the MAXIMUM power across all characters you control.

Example:
- Start as JJ (gun=1)
- Rescue Champ → now you have max(JJ gun=1, Champ gun=2) = gun=2
- This means rescuing Champ gives you gun power 2 WITHOUT collecting any Zillion items!

## How Requirements Work

### Location Requirements (`zz_loc.req`)

Each location has a `Req` object with these fields:
- `gun`: Power level needed (0-3)
- `jump`: Power level needed (0-3)
- `skill`: Skill requirement (usually 0-2, set by options)
- `hp`: HP requirement (for high-difficulty jumps)
- `red`: Number of Red ID Cards needed
- `floppy`: Number of Floppy Disks needed
- `char`: Tuple of acceptable characters (usually all 3)
- `door`: Door code (for locked rooms)
- `union`: OR requirements (tuple of alternate Reqs)

### Player Abilities

Abilities are calculated by `randomizer.make_ability()`:

```python
gun = max(char_to_gun[char][gun_levels][min(zillion_count, max_index)]
          for char in have_chars)

jump = max(char_to_jump[char][jump_levels][min(level, max_index)]
           for char in have_chars)

level = min(opa_count // opas_per_level, max_level - 1)
```

Where:
- `have_chars` starts with `[start_char]` and grows when you rescue others
- `zillion_count` = number of Zillion items collected
- `opa_count` = number of Opa-Opa items collected
- `gun_levels` and `jump_levels` are options (vanilla/balanced/low/restrictive)

### Lookup Tables

The `char_to_gun` and `char_to_jump` tables are in:
`/home/user/Archipelago-CC/.venv/lib/python3.11/site-packages/zilliandomizer/options/__init__.py`

Example - gun power for balanced:
```python
char_to_gun = {
    "JJ": {"balanced": [1, 2, 2, 3]},
    "Apple": {"balanced": [1, 1, 2, 2, 3]},
    "Champ": {"balanced": [2, 2, 3]}
}
```

Index = number of Zillion items, Value = gun power

Example - jump power for balanced:
```python
char_to_jump = {
    "JJ": {"balanced": [1, 2, 2, 2, 3, 3, 3, 3]},
    "Apple": {"balanced": [2, 2, 3, 3, 3, 3, 3, 3]},
    "Champ": {"balanced": [1, 1, 1, 2, 2, 2, 3, 3]}
}
```

Index = level (calculated from Opa-Opas), Value = jump power

## How to Fix the Exporter

### Current Problems

File: `/home/user/Archipelago-CC/exporter/games/zillion.py`

1. **Lines 58-78**: Incorrectly assumes gun=1 means starting gun
   ```python
   # WRONG!
   if req.gun > 1:
       conditions.append({'type': 'item_check', 'item': 'Zillion',
                         'count': {'type': 'constant', 'value': req.gun - 1}})
   ```

2. **Lines 80-85**: Incorrectly assumes jump levels correlate to "Jump Shoes" items
   - There is NO "Jump Shoes" item in Zillion!
   - Jump power comes from gaining levels via Opa-Opas

3. **Missing**: No handling of rescue items (Apple, Champ)

4. **Missing**: No awareness of start_char option

### Required Changes

The exporter needs to:

1. **Read the world options** to determine:
   - `start_char` (JJ, Apple, or Champ)
   - `gun_levels` (vanilla, balanced, low, or restrictive)
   - `jump_levels` (vanilla, balanced, low, or restrictive)
   - `opas_per_level` (default: 2)

2. **Import the lookup tables** from zilliandomizer:
   ```python
   from zilliandomizer.options import char_to_gun, char_to_jump
   ```

3. **Calculate minimum items needed** for each requirement:

   For gun requirements:
   ```python
   def get_gun_requirement(req_gun, start_char, gun_levels):
       if req_gun == 0:
           return None  # No requirement

       gun_prog = char_to_gun[start_char][gun_levels]

       # Check if starting power is enough
       if gun_prog[0] >= req_gun:
           return None  # Accessible from start

       # Find minimum Zillions needed
       for i, power in enumerate(gun_prog):
           if power >= req_gun:
               zillion_conditions = {
                   'type': 'item_check',
                   'item': 'Zillion',
                   'count': {'type': 'constant', 'value': i}
               }
               break

       # Check if rescue items can help
       rescue_alternatives = []
       for rescue_char in ['Apple', 'Champ']:
           if rescue_char != start_char:
               rescue_prog = char_to_gun[rescue_char][gun_levels]
               if rescue_prog[0] >= req_gun:
                   # This rescue gives enough power immediately
                   rescue_alternatives.append({
                       'type': 'item_check',
                       'item': rescue_char
                   })

       if rescue_alternatives:
           # OR: (Zillion count) OR (rescue item)
           return {
               'type': 'or',
               'conditions': [zillion_conditions] + rescue_alternatives
           }
       else:
           return zillion_conditions
   ```

   For jump requirements:
   ```python
   def get_jump_requirement(req_jump, start_char, jump_levels, opas_per_level):
       if req_jump == 0:
           return None  # No requirement

       jump_prog = char_to_jump[start_char][jump_levels]

       # Check if starting power is enough
       if jump_prog[0] >= req_jump:
           return None  # Accessible from start

       # Find minimum level (and thus Opa-Opas) needed
       for level, power in enumerate(jump_prog):
           if power >= req_jump:
               min_opas = level * opas_per_level
               opa_conditions = {
                   'type': 'item_check',
                   'item': 'Opa-Opa',
                   'count': {'type': 'constant', 'value': min_opas}
               }
               break

       # Check if rescue items can help
       rescue_alternatives = []
       for rescue_char in ['Apple', 'Champ']:
           if rescue_char != start_char:
               rescue_prog = char_to_jump[rescue_char][jump_levels]
               if rescue_prog[0] >= req_jump:
                   rescue_alternatives.append({
                       'type': 'item_check',
                       'item': rescue_char
                   })

       if rescue_alternatives:
           return {
               'type': 'or',
               'conditions': [opa_conditions] + rescue_alternatives
           }
       else:
           return opa_conditions
   ```

4. **Handle other requirements** (red, floppy, skill, hp, door, union)
   - These are simpler and can use direct item counts
   - door requirements need special handling (collect 4 keywords in a room)
   - union requirements create OR conditions

## Example: Correct Access Rules

For a location with gun=2, jump=1, starting as JJ with balanced settings:

```json
{
  "type": "and",
  "conditions": [
    {
      "type": "or",
      "conditions": [
        {
          "type": "item_check",
          "item": "Zillion",
          "count": {"type": "constant", "value": 1}
        },
        {
          "type": "item_check",
          "item": "Champ"
        }
      ]
    }
  ]
}
```

(jump=1 requires nothing since JJ starts with jump power 1)

## Testing Your Fix

Run the exporter on the test preset:
```bash
cd /home/user/Archipelago-CC
.venv/bin/python3 -m exporter.main \
  --preset frontend/presets/zillion/AP_14089154938208861744
```

Then check that locations match the sphere data:
- Sphere 0 locations should have `"type": "constant", "value": true`
- Locations that appear in later spheres should have appropriate requirements

## Files to Reference

1. **Zilliandomizer options/lookup tables**:
   `/home/user/Archipelago-CC/.venv/lib/python3.11/site-packages/zilliandomizer/options/__init__.py`

2. **Randomizer logic (make_ability)**:
   `/home/user/Archipelago-CC/.venv/lib/python3.11/site-packages/zilliandomizer/randomizer.py` (lines 309-341)

3. **Zillion world (options)**:
   `/home/user/Archipelago-CC/worlds/zillion/options.py`

4. **Current exporter**:
   `/home/user/Archipelago-CC/exporter/games/zillion.py`

5. **Test preset**:
   `/home/user/Archipelago-CC/frontend/presets/zillion/AP_14089154938208861744/`

## Contact

If you have questions, the test scripts I created can help:
- `/home/user/Archipelago-CC/test_zillion_reqs2.py` - Shows actual requirements for locations
- `/home/user/Archipelago-CC/test_gun_jump_logic.py` - Explains power progressions
- `/home/user/Archipelago-CC/test_rescue_logic.py` - Explains rescue item mechanics
