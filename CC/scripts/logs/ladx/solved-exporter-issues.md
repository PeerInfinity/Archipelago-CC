# Links Awakening DX - Solved Exporter Issues

## Issue 1: LADXR Internal Item Names Not Mapped - SOLVED

**Fixed:** Added comprehensive item name mappings in exporter/games/ladx.py:271

**Mappings Added:**
- KEY1-KEY9 → Small Key (dungeon names)
- NIGHTMARE_KEY1-9 → Nightmare Key (dungeon names)
- BIRD_KEY → Bird Key
- ANGLER_KEY → Angler Key
- SONG1-3 → Ocarina songs (Ballad of the Wind Fish, Manbo's Mambo, Frog's Song of Soul)
- SEASHELL → Seashell
- TRADING_ITEM_FISHING_HOOK → Fishing Hook
- TRADING_ITEM_NECKLACE → Necklace
- TRADING_ITEM_SCALE → Scale

**Test Progress:**
- Initial failure: Sphere 4.16 (29/164 events, 18%)
- After KEY mappings: Sphere 6.9 (64/164 events, 39%)
- After NIGHTMARE_KEY mappings: Sphere 8.3 (79/164 events, 48%)
- After BIRD_KEY mapping: Sphere 11.4 (127/164 events, 77%)
- After SONG mappings: Sphere 12.4 (139/164 events, 85%)
- After SEASHELL mapping: Sphere 12.8 (143/164 events, 87%)
- After TRADING_ITEM mappings: Sphere 151 (150/164 events, 91%)

**Impact:** Major improvement - test now processes 91% of spheres before encountering issues.
