# Archipelago Template Test Results Chart

## Multiplayer Test

**Generated:** 2025-10-14 14:08:00

## Summary

- **Total Games:** 1
- **Passed:** 1 (100.0%)
- **Failed:** 0 (0.0%)

## Test Results

| Game Name | Test Result | Gen Errors | Client 1 Status | C1 Checked | C1 Checkable | Client 2 Status | C2 Received | C2 Total | Custom Exporter | Custom GameLogic |
|-----------|-------------|------------|-----------------|------------|--------------|-----------------|-------------|----------|-----------------|------------------|
| Adventure | ✅ Passed | 0 | ✅ | 25 | 24 | ✅ | 25 | 25 | ✅ | ⚫ |

## Notes

- **Gen Errors:** Number of errors during world generation
- **Client 1 (Send Test):** Tests sending location checks from Client 1
  - **C1 Checked:** Total locations checked by Client 1 (includes auto-checked events with id=0)
  - **C1 Checkable:** Manually-checkable locations (excludes auto-checked events with id=0)
  - Client 1 passes if all manually-checkable locations are checked
- **Client 2 (Receive Test):** Tests receiving location checks at Client 2
  - **C2 Received:** Number of location checks received by Client 2
  - **C2 Total:** Total locations expected to be received (includes all events)
  - Client 2 passes if all expected locations are received
- **Custom Exporter:** ✅ Has custom Python exporter script, ⚫ Uses generic exporter
- **Custom GameLogic:** ✅ Has custom JavaScript game logic, ⚫ Uses generic logic

**Pass Criteria:** A test is marked as ✅ Passed only if:
- Generation errors = 0 (no errors during world generation)
- Client 1 passed (all manually-checkable locations sent)
- Client 2 passed (all expected locations received)
- Both clients completed successfully
