const [lo, hi] = (process.env.DUMP_CS ?? '0,-1').split(',').map(Number);
globalThis.__CSOUT = (x) => { if (x.k >= lo && x.k <= hi) process.stderr.write('CS ' + JSON.stringify(x) + '\n'); };
