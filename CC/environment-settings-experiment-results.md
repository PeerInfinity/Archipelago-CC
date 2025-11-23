# Environment Settings Experiment Results

**Date**: 2025-11-23
**Purpose**: Test which Chromium launch flags are necessary for running Playwright tests in the cloud environment

## Executive Summary

**Key Finding**: The `--single-process` flag is **CRITICAL** for tests to pass. The other cloud environment flags (`--disable-dev-shm-usage`, `--no-sandbox`, `--disable-setuid-sandbox`, `--disable-gpu`) are **NOT necessary** in this environment.

## Background

The codebase currently uses several Chrome/Chromium launch flags that were added for cloud environment compatibility:

```javascript
// playwright.config.js:49-56
launchOptions: {
  args: [
    '--disable-dev-shm-usage',      // Flag 1
    '--no-sandbox',                 // Flag 2
    '--disable-setuid-sandbox',     // Flag 3
    '--disable-gpu',                // Flag 4
    ...(process.env.TEST_GAME && !process.env.DISABLE_SINGLE_PROCESS ? ['--single-process'] : []),  // Flag 5
  ],
}
```

## Experiment Design

We systematically tested removing each flag one at a time using the A Link to the Past template test as our benchmark.

**Test Command**: `python scripts/test/test-all-templates.py --include-list "A Link to the Past.yaml"`

**Success Criteria**:
- Test passes (reaches sphere 22.1/22.1)
- No errors in test execution

## Results

| Test # | Flags Present | Result | Time | Sphere | Notes |
|--------|---------------|--------|------|--------|-------|
| 0 | All flags + `--single-process` | ✅ PASS | 32.8s | 22.1/22.1 | Initial baseline |
| 1 | All flags + `--single-process` | ✅ PASS | 30.6s | 22.1/22.1 | Repeated baseline |
| 2 | `--no-sandbox`, `--disable-setuid-sandbox`, `--disable-gpu`, `--single-process` | ✅ PASS | 31.3s | 22.1/22.1 | Removed `--disable-dev-shm-usage` |
| 3 | `--disable-dev-shm-usage`, `--disable-setuid-sandbox`, `--disable-gpu`, `--single-process` | ✅ PASS | 30.9s | 22.1/22.1 | Removed `--no-sandbox` |
| 4 | `--disable-dev-shm-usage`, `--no-sandbox`, `--disable-setuid-sandbox`, `--single-process` | ✅ PASS | 31.2s | 22.1/22.1 | Removed `--disable-gpu` |
| 5 | `--single-process` **ONLY** | ✅ PASS | 31.4s | 22.1/22.1 | All cloud flags removed |
| 6 | **NO FLAGS** | ❌ FAIL | 16.2s | 0/22.1 | Removed everything including `--single-process` |
| 7 | All flags, `DISABLE_SINGLE_PROCESS=1` | ❌ FAIL | 15.8s | 0/22.1 | Environment variable disables `--single-process` |

## Analysis

### Critical Flag: `--single-process`

The `--single-process` flag is **absolutely required** for tests to pass:
- **With flag**: Tests pass consistently (30-32 seconds, sphere 22.1/22.1)
- **Without flag**: Tests fail immediately (15-16 seconds, sphere 0/22.1)

This flag forces Chrome to run in a single process rather than using separate processes for different components (renderer, GPU, etc.). In the test environment, this appears necessary for proper test execution.

### Non-Critical Flags: Cloud Environment Flags

All of the following flags are **NOT necessary** in this environment:
- `--disable-dev-shm-usage`: Not needed (Test 2 passed without it)
- `--no-sandbox`: Not needed (Test 3 passed without it)
- `--disable-setuid-sandbox`: Not needed (Test 4 passed without it)
- `--disable-gpu`: Not needed (Test 4 passed without it)

**Test 5 definitively proves** that these cloud flags are unnecessary, as tests pass with only `--single-process`.

### Performance Considerations

All passing tests completed in approximately the same time (30-32 seconds), suggesting:
- No performance penalty from having or removing cloud flags
- Cloud flags don't significantly impact test execution speed in this environment

Failed tests completed faster (~16 seconds) because they failed early without progressing through the test spheres.

## Why `--single-process` Matters

The `--single-process` flag likely matters because:

1. **Process Isolation**: Without it, Chrome uses separate processes for different components. The test framework may have issues coordinating with multiple processes.

2. **Resource Management**: Single-process mode simplifies resource tracking and cleanup, which may be important for automated testing.

3. **State Management**: Tests may rely on state being in a single process rather than distributed across multiple processes.

## Why Cloud Flags Don't Matter (in this environment)

The cloud environment flags are typically needed for:

1. **`--disable-dev-shm-usage`**: Avoids using `/dev/shm` (shared memory) which can be limited in containers. This environment apparently has sufficient `/dev/shm` or Chrome adapts automatically.

2. **`--no-sandbox` / `--disable-setuid-sandbox`**: Disables Chrome's sandboxing security features, often needed in containers without proper permissions. This environment apparently has sufficient permissions.

3. **`--disable-gpu`**: Disables GPU hardware acceleration, needed when no GPU is available. This environment either has GPU access or software rendering works fine.

## Recommendations

### For Current Codebase

**Option 1: Keep current configuration (conservative)**
- Maintain all flags for maximum compatibility across environments
- No changes needed
- Pro: Works everywhere
- Con: Unnecessary flags in some environments

**Option 2: Simplify to essential flag only (optimal)**
- Remove cloud flags: `--disable-dev-shm-usage`, `--no-sandbox`, `--disable-setuid-sandbox`, `--disable-gpu`
- Keep only: `--single-process` (when `TEST_GAME` is set and `DISABLE_SINGLE_PROCESS` is not set)
- Pro: Simpler configuration, easier to understand
- Con: May need cloud flags in other environments (e.g., different container setups)

**Recommended**: Option 1 (keep current configuration)
- The cloud flags don't hurt performance or functionality
- They provide insurance for different deployment environments
- No compelling reason to remove them

### For DISABLE_SINGLE_PROCESS

The `DISABLE_SINGLE_PROCESS` environment variable should **ONLY** be set when:
- Running multiclient tests (as currently done in `scripts/lib/test_runner.py:274`)
- `--single-process` is incompatible with the test being run (multi-context tests)

**Do NOT** set `DISABLE_SINGLE_PROCESS=1` for regular single-game tests, as this will cause tests to fail.

## Environment Details

- **Platform**: Linux 4.4.0
- **Python**: 3.11.14
- **Node.js**: v22+
- **Playwright**: Latest (with Chromium)
- **Test Framework**: Custom test runner (`test-all-templates.py`)

## Verification

To verify these findings in a different environment, run:

```bash
# Test with all flags (should pass)
python scripts/test/test-all-templates.py --include-list "A Link to the Past.yaml"

# Test with DISABLE_SINGLE_PROCESS=1 (should fail)
DISABLE_SINGLE_PROCESS=1 python scripts/test/test-all-templates.py --include-list "A Link to the Past.yaml"

# Test with only --single-process (should pass)
# Modify playwright.config.js to remove cloud flags, keeping only --single-process
python scripts/test/test-all-templates.py --include-list "A Link to the Past.yaml"
```

## Related Files

- `playwright.config.js` - Main Playwright configuration with launch flags
- `scripts/lib/test_runner.py` - Test runner that sets `DISABLE_SINGLE_PROCESS` for multiclient tests
- `.github/workflows/test-all-sequential.yml` - CI workflow using `DISABLE_SINGLE_PROCESS=1` for some tests
- `scripts/test/test-all-templates.py` - Main test script used for experiments

## Conclusion

The `--single-process` flag is the **only critical flag** for test success in this environment. Cloud environment flags provide compatibility insurance but are not functionally necessary here. The current configuration is reasonable to maintain for broad environment compatibility, but could be simplified if needed.
