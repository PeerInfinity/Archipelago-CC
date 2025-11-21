#!/usr/bin/env python
import json

with open('output/smz3/seed_1/player_1_settings.json', 'r') as f:
    settings = json.load(f)
    reward_regions = settings.get('reward_regions', {})
    print('Pendant regions (checking for mask 6 = PendantGreen(2) | PendantNonGreen(4)):')
    for region, info in reward_regions.items():
        reward_type = info.get('reward_type', 0)
        if (reward_type & 6) != 0:
            print(f'  {region}: reward_type={reward_type} (matches mask 6)')
    print()
    print('All reward regions:')
    for region, info in reward_regions.items():
        reward_type = info.get('reward_type', 0)
        print(f'  {region}: reward_type={reward_type}')
