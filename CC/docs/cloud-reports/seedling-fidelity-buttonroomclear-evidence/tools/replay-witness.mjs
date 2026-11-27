// Replay the model OFF and ON (`publishedButtonRoomSetter`) against each committed game stream (`d3/witness-p4g.json`):
// the max px over the drained rows, the row count, the final level, and the L37/L38 cleared set (the model's
// `earnedClears` + `bankedClears` + `unreadRoomWrites` + the tape's staged clears, against the game's last
// `persistence_cleared` sample). usage: node replay-witness.mjs [witness.json] (OVER='{"k":true}' adds keys to both arms)
import { readFileSync } from 'node:fs';
const R = '../../../../../frontend/modules/seedlingDemo/';
const B = await import(`${R}fidelityPublishedButtonRoom.js`);
const { l25Sets } = await import(`${R}fidelityL25ApItem.js`);
const { withContactFidelity } = await import(`${R}contactFidelity.js`);
const ROOT = new URL('../../../../../', import.meta.url).pathname;
const S = l25Sets(ROOT);
const W = JSON.parse(readFileSync(process.argv[2] ?? new URL('../d3/witness-p4g.json', import.meta.url), 'utf8'));
const over = JSON.parse(process.env.OVER ?? '{}');
const KEY = 'publishedButtonRoomSetter';
const clearedOf = (shape, run) => {
    const s = new Set(shape.clears.map((t) => `38,${t}`));
    if (run) for (const c of [...run.earnedClears, ...run.bankedClears, ...run.ledger('unreadRoomWrites')]) if (c.level === 37 || c.level === 38) s.add(`${c.level},${c.tag}`);
    return [...s].sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).join(' ');
};
let allOk = true;
const mismatches = [];
for (const row of W.rows) {
    const shape = B.brShape(row.shape);
    const game = row.drain.ticks;
    const gameCleared = row.summary.cleared.split(' ').filter(Boolean).sort((a, b) => a.localeCompare(b, 'en', { numeric: true })).join(' ');
    const out = {};
    for (const on of [false, true]) {
        const r = withContactFidelity({ ...over, [KEY]: on }, () => B.hangReplay(B.brTape(ROOT, shape), (n) => B.hangRecord(S.vanillaSource(n), shape)));
        let px = 0, firstDiff = null;
        for (let i = 0; i < Math.min(game.length, r.rows.length); i++) {
            const d = game[i].level !== r.rows[i].level ? Infinity : Math.max(Math.abs(game[i].x - r.rows[i].x), Math.abs(game[i].y - r.rows[i].y));
            if (d > 0 && firstDiff === null) firstDiff = { row: i, game: game[i], model: r.rows[i] };
            px = Math.max(px, d);
        }
        const cleared = clearedOf(shape, r.run);
        out[on ? 'ON' : 'OFF'] = { rowsJson: JSON.stringify(r.rows), firstDiff, px: px === Infinity ? 'level differs' : +px.toFixed(6), rows: r.rows.length, level: r.rows.at(-1)?.level, cleared, clearedMatch: cleared === gameCleared, err: r.error?.message?.slice(0, 120) ?? null };
    }
    const ok = out.ON.px === 0 && out.ON.rows === game.length && out.ON.clearedMatch && !out.ON.err;
    const sameRows = out.ON.rowsJson === out.OFF.rowsJson;
    if (!ok) mismatches.push(`${row.shape}${sameRows ? ' (ON rows = OFF rows: not this key)' : ''}`);
    allOk &&= ok;
    for (const k of ['OFF', 'ON']) delete out[k].rowsJson;
    console.log(`${row.shape}: game rows ${game.length} level ${game.at(-1).level} cleared [${gameCleared}]\n   OFF ${JSON.stringify(out.OFF)}\n   ON  ${JSON.stringify(out.ON)}  ${ok ? 'ON = GAME' : `ON ≠ GAME${sameRows ? ' — ON rows = OFF rows' : ''}`}`);
}
console.log(`OVER ${JSON.stringify(over)}: ${W.rows.length - mismatches.length}/${W.rows.length} shapes ON = GAME (0 px, rows, cleared set)${mismatches.length ? `; not: ${mismatches.join(', ')}` : ''}`);
