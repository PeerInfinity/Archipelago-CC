import fs from 'node:fs';
const P = await import(process.cwd() + '/scripts/procgen/make-seedling-playthrough-rules.mjs');
fs.writeFileSync(process.argv[2], JSON.stringify(Object.fromEntries(P.playthroughKillLocks)));
console.log([...P.playthroughKillLocks].map(([k, v]) => `${k}:${v.verdict}`).join(' '));
