// Replay committed tapes through the model OFF and ON (the key named by env KEY, default frozenTickUngated), and diff the whole stream + ledgers (wave 51's tool, re-keyed).
// usage: node tape-onoff.mjs <tape-name> [...]
import { readFileSync } from 'node:fs';
import { withContactFidelity } from '../../../../../frontend/modules/seedlingDemo/contactFidelity.js';
import { atlasLevelSource } from '../../../../../frontend/modules/seedlingDemo/levelSource.js';
import { runTape } from '../../../../../frontend/modules/seedlingDemo/tapeRunner.js';
const dir = new URL('../../../../../frontend/modules/seedlingDemo/fixtures/tapes/', import.meta.url);
for (const name of process.argv.slice(2)) {
    const tape = JSON.parse(readFileSync(new URL(`${name}.json`, dir), 'utf8'));
    const go = (on) => withContactFidelity({ [process.env.KEY ?? 'frozenTickUngated']: on }, () => {
        try { return JSON.stringify(runTape(tape, { levelSource: atlasLevelSource() })); } catch (e) { return `THROW ${e.message}`; }
    });
    const off = go(false);
    const on = go(true);
    console.log(name, off === on ? 'ON = OFF (byte-identical result)' : 'DIFFERS', off.length, on.length);
    if (off !== on) { let i = 0; while (off[i] === on[i]) i++; console.log('  first diff at char', i, '\n  off:', off.slice(Math.max(0, i - 200), i + 200), '\n  on: ', on.slice(Math.max(0, i - 200), i + 200)); }
}
