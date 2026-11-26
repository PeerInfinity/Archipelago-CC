// DEADFRAME D3: the probe's counters for an in-process run (the acceptance batch): `node --import <this> <script>`.
globalThis.__DFP = { c: {} };
process.on('exit', () => process.stderr.write(`DEADFRAME-PROBE ${JSON.stringify(globalThis.__DFP.c)}\n`));
