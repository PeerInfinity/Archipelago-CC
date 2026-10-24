// SCRATCH: print the hammer-phase switches and CONTACT_FIDELITY at this tree's defaults.
import { join } from 'node:path';
const R = process.env.REPO ?? '/home/user/Archipelago-CC';
const sb = await import(join(R, 'frontend/modules/seedlingDemo/solverBot.js'));
const pk = await import(join(R, 'frontend/modules/seedlingDemo/pressKillCost.js'));
const gs = await import(join(R, 'frontend/modules/seedlingDemo/ghostSpinnerPress.js'));
const cf = await import(join(R, 'frontend/modules/seedlingDemo/contactFidelity.js'));
const pick = (m) => Object.fromEntries(Object.entries(m).filter(([k, v]) => /^[A-Z][A-Z0-9_]+$/.test(k) && v && typeof v === 'object'
    && 'enabled' in v).map(([k, v]) => [k, v.enabled]).sort());
console.log(JSON.stringify({ solverBot: pick(sb), pressKillCost: pick(pk), ghostSpinnerPress: pick(gs),
    STRIKE_PREVIEW_CAP: sb.STRIKE_PREVIEW_CAP, HAMMER_ESCAPE_BOUNDS: sb.HAMMER_ESCAPE_BOUNDS }, null, 1));
console.log('CONTACT_FIDELITY', JSON.stringify(cf.CONTACT_FIDELITY, null, 1));
