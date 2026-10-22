import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { heldKeysAt, parseTape } from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/tapeFormat.js';
const t = parseTape(readFileSync(process.argv[2], 'utf8'));
const rows = []; for (let i = 0; i < t.tick_count; i += 1) rows.push([...heldKeysAt(t, i)].sort().join('+'));
console.log(t.tick_count, createHash('md5').update(rows.join('\n')).digest('hex'));
