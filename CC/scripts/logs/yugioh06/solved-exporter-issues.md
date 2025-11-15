# Yu-Gi-Oh! 2006 - Solved Exporter Issues

## Fixed: Comment Removal Breaks Strings with # Characters

**Fixed:** 2025-11-15
**Files Modified:** `exporter/analyzer/source_extraction.py`

### Problem
The source extraction code was using a simple regex `r'#.*$'` to remove Python comments, but this also removed `#` characters inside string literals like `"Morphing Jar #2"`, causing unterminated string literal errors during AST parsing.

### Solution
Implemented a tokenize-based comment removal function that properly distinguishes between actual comments and `#` characters in string literals:

```python
def remove_comments_from_source(source: str) -> str:
    """Remove Python comments while preserving # in string literals using tokenize."""
    try:
        tokens = tokenize.tokenize(io.BytesIO(source.encode('utf-8')).readline)
        result = []
        for tok in tokens:
            if tok.type == tokenize.COMMENT:
                continue
            # ... (reconstruct source without comments)
        return ''.join(result).strip()
    except Exception as e:
        # Fallback to regex if tokenization fails
        return re.sub(r'#.*$', '', source, flags=re.MULTILINE).strip()
```

### Impact
- Access rules with card names containing `#` now export correctly
- "No More Cards Bonus" location now has proper access rule exported

## Fixed: Item Groups Not Assigned to Event Items

**Fixed:** 2025-11-15
**Files Modified:** `exporter/exporter.py`

### Problem
Event items (items with `code=None`) weren't getting their group assignments because the group-adding logic only ran for items in `world.item_id_to_name`. This caused `group_check` rules to fail because items like "Tier 1 Beaten" didn't have the "Campaign Boss Beaten" group assigned.

### Solution
Added a final pass after all items are collected to add groups from `world.item_name_groups` to ALL items, including event items:

```python
# 5. Add groups from item_name_groups to ALL items (including events)
item_name_groups = getattr(world, 'item_name_groups', {})
if item_name_groups:
    for group_name, group_items in item_name_groups.items():
        for item_name in group_items:
            if item_name in items_data:
                if group_name not in items_data[item_name]['groups']:
                    items_data[item_name]['groups'].append(group_name)
```

### Impact
- Event items like "Tier 1 Beaten" now properly have "Campaign Boss Beaten" group
- `group_check` rules can now correctly count items in groups
- "No Damage Bonus" location access rule now works correctly
