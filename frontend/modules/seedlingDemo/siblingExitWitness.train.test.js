/**
 * ⛓ SIBLING-EXIT — the L16 pit witness, the `in_L15_144_16` arrival (train tier, ~70 s). The rows and their reading:
 * `siblingExitWitnessRows.js`.
 */
import { describe, expect, it } from 'vitest';

import { SIBLING_WITNESS_ARRIVALS, siblingExitWitnessRows } from './siblingExitWitnessRows.js';

siblingExitWitnessRows({ describe, expect, it }, [SIBLING_WITNESS_ARRIVALS.L15]);
