#!/usr/bin/env python3
import json

# Read the sphere log
inventory = {}
with open('frontend/presets/kh2/AP_14089154938208861744/AP_14089154938208861744_spheres_log.jsonl', 'r') as f:
    for line_num, line in enumerate(f, 1):
        event = json.loads(line)

        # Stop at sphere 7.3 (after 7.2)
        if event['type'] == 'state_update':
            sphere_index = event['sphere_index']

            # Process inventory updates
            player_data = event.get('player_data', {}).get('1', {})
            new_items = player_data.get('new_inventory_details', {}).get('resolved_items', {})

            # Add to inventory
            for item_name, count in new_items.items():
                inventory[item_name] = inventory.get(item_name, 0) + count

            if sphere_index == "7.2":
                print(f"Inventory at sphere 7.2 (after collecting items):")
                print("=" * 60)
                for item_name in sorted(inventory.keys()):
                    count = inventory[item_name]
                    if count > 0:
                        print(f"  {item_name}: {count}")
                print("=" * 60)
                print()

                # Check specific items for CoR access
                print("Items needed for CoR Fight 1 access:")
                print("-" * 60)
                print(f"Quick Run: {inventory.get('Quick Run', 0)} (need 2)")
                print(f"Aerial Dodge: {inventory.get('Aerial Dodge', 0)} (need 1)")
                print()
                print(f"Reflect Element: {inventory.get('Reflect Element', 0)} (need 3 for tool)")
                print(f"Chicken Little: {inventory.get('Chicken Little', 0)} (need 1 for tool)")
                print(f"Magnet Element: {inventory.get('Magnet Element', 0)} (need 2 for tool)")
                print(f"Explosion: {inventory.get('Explosion', 0)} (need 1 for tool)")
                print(f"Finishing Leap: {inventory.get('Finishing Leap', 0)} (need 1 for tool)")
                print(f"Thunder Element: {inventory.get('Thunder Element', 0)} (need 2 for tool)")
                print(f"Stitch: {inventory.get('Stitch', 0)} (need 1 for tool)")
                print()
                print("Forms:")
                print(f"Valor Form: {inventory.get('Valor Form', 0)}")
                print(f"Wisdom Form: {inventory.get('Wisdom Form', 0)}")
                print(f"Limit Form: {inventory.get('Limit Form', 0)}")
                print(f"Master Form: {inventory.get('Master Form', 0)}")
                print(f"Final Form: {inventory.get('Final Form', 0)}")
                print(f"Light & Darkness: {inventory.get('Light & Darkness', 0)}")
                break
