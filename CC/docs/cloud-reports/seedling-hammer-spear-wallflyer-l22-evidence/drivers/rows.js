// node rows.js <frames.json> <out rows.json> — first frame per tick → [t, level, hits, hits_timer, x, y]; prints the summary.
const fs = require('fs');
const f = JSON.parse(fs.readFileSync(process.argv[2]));
const seen = new Set(); const rows = [];
for (const fr of f.frames) { if (seen.has(fr.tick)) continue; seen.add(fr.tick); rows.push([fr.tick, fr.status.level, fr.status.hits, fr.status.hits_timer, fr.player?.x ?? null, fr.player?.y ?? null]); }
fs.writeFileSync(process.argv[3], JSON.stringify(rows));
const maxHits = Math.max(...rows.map((r) => r[2])); const cross = rows.find((r) => r[1] !== rows[0][1]);
console.log(JSON.stringify({ ticks: rows.length, maxHits, anyHitsTimer: rows.some((r) => r[3] > 0), firstOtherLevel: cross ?? null, last: rows[rows.length - 1] }));
