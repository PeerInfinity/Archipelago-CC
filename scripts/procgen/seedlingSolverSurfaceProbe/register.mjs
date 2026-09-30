/**
 * `node --import ./scripts/procgen/seedlingSolverSurfaceProbe/register.mjs <script>`
 * runs `<script>` with every `createLevelRun` result wrapped in the recording
 * Proxy (`recorder.mjs`). The record is written to `$SURFACE_PROBE_OUT` at exit.
 */
import { register } from 'node:module';
import { installRecorder } from './recorder.mjs';

installRecorder(process.env.SURFACE_PROBE_OUT ?? null);
register('./hooks.mjs', import.meta.url);
