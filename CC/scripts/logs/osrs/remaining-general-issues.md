# Remaining General Issues for Old School Runescape

## Issue 1: location_row.qp Attribute Access

**Status**: Not Fixed
**Priority**: Medium

**Description**:
Some access rules reference `location_row.qp` which is an attribute of the Python LocationRow object. This should be resolved to a constant value by the exporter.

**Example**:
```json
{
  "type": "attribute",
  "object": {"type": "name", "name": "location_row"},
  "attr": "qp"
}
```

Should be converted to:
```json
{
  "type": "constant",
  "value": 5
}
```

**Solution**:
The exporter should:
1. Detect attribute access on `location_row`
2. Look up the actual location row data
3. Extract the qp value
4. Replace with a constant

This might already be handled by the generic exporter's attribute resolution, but needs verification.
