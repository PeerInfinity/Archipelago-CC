// scratch: run leg.mjs with the lab's __C4 sink on stderr
globalThis.__C4 = (r) => process.stderr.write('C4 ' + JSON.stringify(r) + '\n');
await import('./leg.mjs');
