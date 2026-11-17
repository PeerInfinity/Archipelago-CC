// Detail one staging: tape keys (all, primary kept) to `from`, then hold `dir` for `dur`; print owlTicks/contacts near `lo..hi`.
import { stage } from './stage.mjs';
import { heldKeysAt } from '../../../../../frontend/modules/seedlingDemo/tapeFormat.js';
const o = Object.fromEntries(process.argv.slice(2).map((a) => a.split('=')));
const from = +o.from; const dur = +o.dur; const dir = o.dir.split('+'); const keep = o.keepPrimary !== '0';
const keysAt = (t, tape) => (t < from ? new Set([...heldKeysAt(tape, t)].filter((k) => keep || t < 10 || k !== 'primary'))
    : t < from + dur ? new Set(dir) : new Set());
for (const owl of [false, true]) {
    const r = stage({ suit: o.suit === '1', ticks: +(o.ticks ?? 816), owl, keysAt });
    console.log(`== ${owl ? 'ON' : 'OFF'} thrown:`, r.thrown?.slice(0, 160));
    console.log(' hits', JSON.stringify(r.run.ledger('playerHits').map((h) => ({ t: h.t, s: h.source, hits: h.hits, kb: h.knockback, ret: h.retaliation }))));
    for (const w of r.owlTicks.filter((x) => x.t >= +o.lo && x.t <= +o.hi)) {
        console.log(' ', w.t, w.phase, w.bossX.toFixed(4), w.bossY.toFixed(4), 'hits', w.hits, 'rft', w.rockfallTime, 'cpod', w.cpod, 'draws', w.streamCount);
    }
}
