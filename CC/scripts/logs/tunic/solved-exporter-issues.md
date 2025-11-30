# Solved Exporter Issues for TUNIC

This document tracks resolved issues in the TUNIC exporter (`exporter/games/tunic.py`).

## Solved Issues

### 1. Shop N intermediate regions missing (SOLVED)

**Date Solved:** 2025-11-30

**Description:** The TUNIC world creates intermediate "Shop N" regions (Shop 1, Shop 2, etc.) that connect one-way to the main "Shop" region. These intermediate regions were not being exported to rules.json, causing exits to point to non-existent regions.

**Error Message:**
```
Regions accessible in LOG but NOT in STATE: Shop
```

**Root Cause:** The Python world creates dynamically-named "Shop N" regions in `er_scripts.py:create_shop_region()` that each connect one-way to the main "Shop" region. Exits from various regions (like "Windmill", "West Garden before Terry", etc.) pointed to these intermediate regions, but they weren't being exported.

**Solution:** Added a `post_process_data()` method to the TUNIC exporter that redirects all exits pointing to "Shop N" (where N is a number) to point directly to "Shop". This simplifies the region graph since the intermediate "Shop N" regions only have unconditional exits to "Shop" anyway.

**Files Modified:**
- `exporter/games/tunic.py` - Added `post_process_data()` method

**Code Change:**
```python
def post_process_data(self, data: Dict[str, Any]) -> Dict[str, Any]:
    """Post-process TUNIC export data.

    Redirects exits pointing to 'Shop N' intermediate regions to point
    directly to 'Shop'. In TUNIC, all shops are the same shop, but there are
    intermediate 'Shop N' regions that connect one-way to 'Shop'. Since these
    intermediate regions only have an unconditional exit to 'Shop', we can
    simplify by having exits go directly to 'Shop'.
    """
    import re

    # Pattern to match "Shop N" where N is a number
    shop_n_pattern = re.compile(r'^Shop \d+$')

    # Process each player's regions
    for player_id, player_regions in data.get('regions', {}).items():
        for region_name, region_data in player_regions.items():
            for exit_data in region_data.get('exits', []):
                connected_region = exit_data.get('connected_region', '')
                if shop_n_pattern.match(connected_region):
                    logger.debug(f"Redirecting exit from '{region_name}' -> '{connected_region}' to 'Shop'")
                    exit_data['connected_region'] = 'Shop'
                    # Also update the name to reflect the change
                    if 'name' in exit_data:
                        exit_data['name'] = exit_data['name'].replace(connected_region, 'Shop')

    return data
```
