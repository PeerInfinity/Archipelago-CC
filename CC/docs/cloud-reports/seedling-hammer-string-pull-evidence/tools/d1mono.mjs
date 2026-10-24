// D1 (scratch tree only): is "controller path clear" monotone in j from each anchor? Does a binary search agree?
globalThis.__mono = { anchors: 0, nonMonotone: 0, binaryDiffers: 0 };
process.on('exit', () => process.stderr.write(`D1MONO ${JSON.stringify(globalThis.__mono)}\n`));
