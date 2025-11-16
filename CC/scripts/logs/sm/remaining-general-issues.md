# Super Metroid - Remaining General Issues

## Open Issues

### 1. Regions not accessible from starting position
**Status**: Critical - blocking all progress

**Description**: The spoiler test shows that even basic regions that should be accessible at Sphere 0 are not being reached:
- Blue Brinstar Elevator Bottom
- Energy Tank, Brinstar Ceiling
- Morphing Ball
- Various Blue Brinstar missile locations

**Error**: "Regions accessible in LOG but NOT in STATE"

**Root Cause**: The access rules contain unresolved name references (`ret`) or unexpanded helper calls that the frontend can't evaluate.

**Impact**: Test fails immediately at Sphere 0 - no progression possible.

**Next Steps**:
1. Debug why Landing Site -> Blue Brinstar Elevator Bottom isn't working
2. Check start region configuration
3. Verify Menu -> Ceres -> Landing Site path is working
4. Fix rule evaluation for `ret` name references

### 2. Need to choose implementation approach
**Status**: Decision needed

**Description**: There are multiple possible approaches to handle SM's complex VARIA logic:

**Option A**: Full VARIA implementation in JavaScript
- Pros: Most accurate to Python logic
- Cons: Extremely complex, hundreds of helpers, difficulty calculations

**Option B**: Simplified item-based logic
- Pros: Easier to implement and maintain
- Cons: May not match all edge cases, won't support advanced tech/difficulty

**Option C**: Hybrid approach
- Implement common helpers in JS
- Use simplified logic for rare cases
- Pros: Balance of accuracy and practicality
- Cons: Need to identify which helpers are critical

**Recommendation**: Start with Option C - implement the most commonly used helpers first, then add more as needed.

