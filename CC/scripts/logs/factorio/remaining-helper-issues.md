# Factorio Helper Issues - Remaining

## Issue 1: Event items not accessible in Sphere 2.1

**Symptom:**
- Test fails at Sphere 2.1 with 34 locations showing "Access rule evaluation failed"
- All failing locations check for event item "Automated logistic-science-pack"
- Example failing location (AP-2-072) requires BOTH:
  - "Automated automation-science-pack" (from Sphere 0.1)
  - "Automated logistic-science-pack" (from Sphere 2.1)

**Affected Locations:**
AP-2-072, AP-2-179, AP-2-255, AP-2-269, AP-2-270, AP-2-272, AP-2-328, AP-2-338, AP-2-413, AP-2-416, AP-2-469, AP-2-473, AP-2-491, AP-2-502, AP-2-507, AP-2-514, AP-2-524, AP-2-569, AP-2-585, AP-2-634, AP-2-644, AP-2-650, AP-2-652, AP-2-654, AP-2-683, AP-2-688, AP-2-763, AP-2-784, AP-2-794, AP-2-861, AP-2-889, AP-2-898, AP-2-901, AP-2-996

**Investigation Findings:**
1. Event items are correctly exported in rules.json with event:true, advancement:true
2. The "Automate logistic-science-pack" location gives "Automated logistic-science-pack" event item
3. Progressive item mapping is correct (progressive-science-pack resolves to logistic-science-pack)
4. The location's access rule uses all_of to check required_technologies["logistic-science-pack"]
5. Helper function has() supports both direct inventory check and progressive item resolution

**Likely Root Cause:**
When the spoiler test processes Sphere 2.1:
1. Location "Automate logistic-science-pack" should be checked
2. This should add "Automated logistic-science-pack" to inventory
3. Then the 34 locations should become accessible
4. But the item check for "Automated logistic-science-pack" is failing

Possible causes:
- Event item not being added to inventory when location is checked
- Timing issue in the spoiler test (comparison happens before item is added)
- Helper function not finding the event item in inventory

**ROOT CAUSE FOUND:**
Event items are being stored in inventory with incorrect names!
- Location gives: "Automated automation-science-pack"
- Inventory contains: "automation-science-pack" (without "Automated" prefix)
- Access rules check for: "Automated automation-science-pack" (correct name)
- Result: Item check fails because inventory has wrong key

Debug output shows:
```
[Factorio has] Checking for: "Automated automation-science-pack"
[Factorio has] Inventory keys: [..., automation-science-pack, ..., logistic-science-pack, ...]
[Factorio has] Item in inventory: 1
[Factorio has] Found "Automated automation-science-pack" in inventory: 1
```

Wait - the output shows it WAS found! But then it also shows:
```
[Factorio has] Checking for: "Automated logistic-science-pack"
[Factorio has] Item in inventory: 0
```

This means "automation-science-pack" exists but "Automated automation-science-pack" doesn't exist as a separate key. The "Automated " prefix is being stripped when items are added to inventory.

**Next Steps:**
1. Find where item names are being transformed (strip "Automated " prefix)
2. Fix the transformation to preserve the full item name
3. Verify fix resolves all 34 failing locations
