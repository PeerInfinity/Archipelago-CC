// DEADFRAME2 D1: the census hooks for an in-process run (the acceptance batch): `node --import <this> <script>` with
// `census2-scratch.py apply`. Prints the totals to stderr at exit. Subprocesses are not counted.
const { makeHooks } = await import(new URL('./census2.mjs', import.meta.url).href);
const t = { spans: {}, overlaps: {}, lumps: {} };
const c = { spans: {}, overlaps: {}, lumps: {} };
globalThis.__DF = makeHooks(c, t);
process.on('exit', () => process.stderr.write(`DEADFRAME2-CENSUS ${JSON.stringify({ spans: Object.fromEntries(Object.entries(t.spans).map(([k, e]) => [k, { ...e, details: undefined }])), overlaps: t.overlaps, lumps: t.lumps })}\n`));
