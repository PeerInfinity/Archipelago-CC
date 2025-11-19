#!/usr/bin/env python3
"""
Debug script to examine Museumsanity rule evaluation
"""

import json

# Load the rules.json file
with open('frontend/presets/stardew_valley/AP_14089154938208861744/AP_14089154938208861744_rules.json') as f:
    rules_data = json.load(f)

# Find the Museumsanity: 3 Artifacts location
location = None
for player_id, player_data in rules_data['regions'].items():
    for region in player_data:
        if 'locations' in region:
            for loc in region['locations']:
                if loc.get('name') == 'Museumsanity: 3 Artifacts':
                    location = loc
                    break
            if location:
                break
        if location:
            break

if not location:
    print('Location not found!')
    exit(1)

print(f'Location: {location["name"]}')
print(f'ID: {location["id"]}')
print(f'\nAccess Rule Type: {location["access_rule"]["type"]}')

# Extract the count_true rule (it's the second condition in the AND)
count_true_rule = location['access_rule']['conditions'][1]
print(f'\n=== Count True Rule ===')
print(f'Required count: {count_true_rule["count"]}')
print(f'Total conditions: {len(count_true_rule["conditions"])}')

# Group conditions by type
conditions_by_type = {}
for cond in count_true_rule['conditions']:
    cond_type = cond['type']
    if cond_type not in conditions_by_type:
        conditions_by_type[cond_type] = []
    conditions_by_type[cond_type].append(cond)

print('\nConditions by type:')
for cond_type, conds in conditions_by_type.items():
    print(f'  {cond_type}: {len(conds)}')

# Show all item_check conditions
item_checks = conditions_by_type.get('item_check', [])
print(f'\n=== Item Check Conditions ({len(item_checks)}) ===')
for i, cond in enumerate(item_checks[:10]):
    count_str = f' (count >= {cond["count"]["value"]})' if 'count' in cond else ''
    print(f'{i}: {cond["item"]}{count_str}')

# Show all complex conditions
and_conditions = conditions_by_type.get('and', [])
print(f'\n=== And Conditions ({len(and_conditions)}) ===')
if and_conditions:
    print('\nFirst And condition:')
    print(json.dumps(and_conditions[0], indent=2))
