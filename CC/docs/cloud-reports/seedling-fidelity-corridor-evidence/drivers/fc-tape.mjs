// the corridor-body forecast stepped against a WALK TAPE's own drive, vs the live run and the game's hit rises
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const REPO = process.env.REPO || '/home/user/Archipelago-CC';
const M = (p) => import(join(REPO, 'frontend/modules/seedlingDemo', p));
const { withContactFidelity } = await M('contactFidelity.js');
const { parseTape, heldKeysAt } = await M('tapeFormat.js');
const { createRunForStaging, solveStaging, stagingFromTape } = await M('tapeRunner.js');
const { patchedMapDocument } = await M('seedlingSetPatches.js');
const { levelSourceFromAtlas } = await M('atlasSource.js');
const [walkP, gameP, step] = process.argv.slice(2);
const tape = parseTape(readFileSync(walkP, 'utf8'));
const players = JSON.parse(readFileSync(gameP, 'utf8'))[step].players;
const MAP = JSON.parse(readFileSync(join(REPO, 'frontend/modules/flashPanel/atlases/seedling-map.json'), 'utf8'));
const staging = solveStaging(stagingFromTape(tape));
const src = levelSourceFromAtlas(patchedMapDocument(MAP));
const rises = []; for (let i = 1; i < players.length; i += 1) if (players[i][1] === players[i - 1][1] && players[i][2] > players[i - 1][2]) rises.push(players[i][0]);
const out = withContactFidelity({ corridorBodyPricing: true }, () => {
    const run = createRunForStaging(staging, src);
    const fc = run.corridorBodyForecast();
    let maxD = 0; const contacts = []; const swings = []; const level = run.level;
    for (let t = 0; t < tape.tick_count; t += 1) {
        const rows = fc.step(run.state, { slashing: run.progress('slashInfo')?.state?.slashing === true });
        const pre = { x: run.state.x, y: run.state.y };
        const before = run.ticksCompleted;
        const { transition } = run.advance(heldKeysAt(tape, t));
        if (transition || run.level !== level) break;
        const struck = (run.chaserPressHits ?? []).filter((h) => h.t === before && (h.tag === 'wallflyer' || h.tag === 'drill')
            && !String(h.why ?? '').startsWith('distanceRectPoint'));
        if (struck.length) { const ids = new Set(struck.map((h) => h.id)); fc.swing(pre, (r, id) => ids.has(id)); swings.push(before + 1); }
        for (const r of rows) if (r.hitsPlayer) contacts.push(before + 1);
        const live = [...(run.wallFlyers?.bodies ?? []), ...(run.drills?.bodies ?? [])];
        for (const r of rows) { const l = live.find((b) => b.id === r.id); if (l) maxD = Math.max(maxD, Math.abs(l.x - r.x), Math.abs(l.y - r.y)); }
    }
    const hits = run.ledger('playerHits').filter((h) => h.source === 'wallflyer' || h.source === 'drill').map((h) => h.t);
    return { ticks: tape.tick_count, maxD, forecastContacts: contacts, modelHits: hits, gameRises: rises, swings: swings.length };
});
console.log(JSON.stringify(out));
