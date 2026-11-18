// Search no-suit (or suit) stagings of r6-owl-kill where owlContactInStep ON vs OFF differ:
// tape keys to t=from (primary stripped from t>=10), then hold `dir` for `dur` ticks, then nothing, to `ticks`.
import { stage } from './stage.mjs';
import { heldKeysAt } from '../../../../../frontend/modules/seedlingDemo/tapeFormat.js';
const o = Object.fromEntries(process.argv.slice(2).map((a) => a.split('=')));
const suit = o.suit === '1';
const keep = o.keepPrimary === '1';
let contacts = 0;
const ticks = +(o.ticks ?? 130);
const DIRS = [['up'], ['down'], ['left'], ['right'], ['up', 'left'], ['up', 'right'], ['down', 'left'], ['down', 'right']];
const sig = (r) => JSON.stringify({ th: r.thrown?.replace(/^t\d+: /, '').slice(0, 60) ?? null, t: r.t,
    h: r.run.ledger('playerHits'), o: r.owlTicks });
let n = 0; const found = [];
for (let from = +(o.fromLo ?? 10); from <= +(o.fromHi ?? 90); from += +(o.fromStep ?? 2)) {
    for (const dir of DIRS) {
        for (let dur = 1; dur <= +(o.durHi ?? 60); dur += +(o.durStep ?? 3)) {
            const keysAt = (t, tape) => (t < from ? new Set([...heldKeysAt(tape, t)].filter((k) => keep || t < 10 || k !== 'primary'))
                : t < from + dur ? new Set(dir) : new Set());
            const a = stage({ suit, ticks, owl: false, keysAt });
            const b = stage({ suit, ticks, owl: true, keysAt });
            n += 1;
            if (a.run.ledger('playerHits').some((x) => x.source === 'owlBody')) contacts += 1;
            if (sig(a) !== sig(b)) {
                const ha = a.run.ledger('playerHits').map((x) => x.t); const hb = b.run.ledger('playerHits').map((x) => x.t);
                found.push({ from, dir: dir.join('+'), dur, offThrown: a.thrown?.slice(0, 140) ?? null,
                    onThrown: b.thrown?.slice(0, 140) ?? null, offHits: ha, onHits: hb });
                if (found.length <= +(o.max ?? 40)) console.log(JSON.stringify(found.at(-1)));
            }
        }
    }
}
console.log(JSON.stringify({ runs: n, withOwlContactOff: contacts, found: found.length }));
