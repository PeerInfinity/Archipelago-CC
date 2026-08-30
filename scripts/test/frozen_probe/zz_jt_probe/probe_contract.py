"""Names shared between the probe and the harness.

Packed into the probe apworld (relative import there) and loaded directly
by scripts/test/test-frozen-install.py — the single source of truth for the
probe's file-name contract.
"""

PROBE_WORLD_NAME = "zz_jt_probe"
# Written by the harness into the install root before the probe run
SIDECAR_NAME = f"{PROBE_WORLD_NAME}_scenario.json"
# Written by the probe into the install root, read + removed by the harness
REPORT_NAME = f"{PROBE_WORLD_NAME}_report.json"
