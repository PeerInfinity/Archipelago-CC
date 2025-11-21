#!/usr/bin/env python3
import json

with open('frontend/presets/smz3/AP_14089154938208861744/AP_14089154938208861744_rules.json') as f:
    data = json.load(f)
    regions = data.get('regions', {})
    for region_name, region in regions.items():
        if not isinstance(region, dict):
            continue
        for loc in region.get('locations', []):
            if isinstance(loc, dict) and loc.get('name') in ['Bombos Tablet', 'Ether Tablet']:
                print(f"{loc.get('name')} is in region: {region_name}")
                print(f"  Access rule: {json.dumps(loc.get('access_rule'), indent=2)}")
                print()
