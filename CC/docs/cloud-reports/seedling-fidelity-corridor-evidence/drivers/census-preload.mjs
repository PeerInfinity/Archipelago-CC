// scratch census preload: `NODE_OPTIONS=--import=<this>` installs solverBot's UNBILLED_DAMAGE_TRACE sink in EVERY node
// process (children included), appending one JSON line per segment success to $CENSUS_OUT. Read-only.
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
const REPO = process.env.REPO || '/home/user/Archipelago-CC';
const sb = await import(resolve(REPO, 'frontend/modules/seedlingDemo/solverBot.js'));
sb.UNBILLED_DAMAGE_TRACE.sink = (row) => appendFileSync(process.env.CENSUS_OUT,
    `${JSON.stringify({ pid: process.pid, argv: process.argv.slice(2).join(' ').slice(0, 300), ...row })}\n`);
