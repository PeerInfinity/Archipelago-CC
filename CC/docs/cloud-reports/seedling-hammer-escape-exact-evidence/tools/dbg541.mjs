const recs = [];
globalThis.__xDbg = (r) => { recs.push(r); if (recs.length >= 6) { console.log(JSON.stringify(recs.map((r) => ({ ...r, bumps: r.bumps.map((b) => [b.t, b.id, b.shoved]) })))); process.exit(0); } };
await import('/tmp/claude-0/sp/leg860.mjs');
