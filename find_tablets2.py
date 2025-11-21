#!/usr/bin/env python3
import json

with open('frontend/presets/smz3/AP_14089154938208861744/AP_14089154938208861744_rules.json') as f:
    data = json.load(f)
    regions = data.get('regions', {})
    print(f"Total regions: {len(regions)}")
    print(f"Regions type: {type(regions)}")

    found = []
    for region_name, region in regions.items():
        if not isinstance(region, dict):
            print(f"Skipping non-dict region: {region_name}")
            continue
        locations = region.get('locations', [])
        for loc in locations:
            if isinstance(loc, dict):
                loc_name = loc.get('name', '')
                if 'Tablet' in loc_name:
                    found.append((region_name, loc_name))

    print(f"\nFound tablet locations:")
    for region_name, loc_name in found:
        print(f"  {loc_name} in {region_name}")
