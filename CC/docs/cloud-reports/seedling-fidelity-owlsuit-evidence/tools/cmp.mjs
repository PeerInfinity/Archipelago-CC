// Compare a staging OFF vs ON (owlContactInStep): every ledger + owlTicks + snapshot.
import { stage } from './stage.mjs';
import { createHash } from 'node:crypto';
const o = Object.fromEntries(process.argv.slice(2).map((a) => a.split('=')));
const args = { tape: o.tape, ticks: o.ticks ? +o.ticks : undefined, suit: o.suit === '1', presses: o.presses !== '0',
    hold: o.hold ?? null, from: +(o.from ?? 0), noDamage: o.noDamage === undefined ? null : o.noDamage === '1', stripFrom: +(o.stripFrom ?? 0), health: +(o.health ?? 0) };
const KINDS = ['playerHits', 'playerDeaths', 'earnedClears', 'presses'];
function digest(r) {
    const led = Object.fromEntries(KINDS.map((k) => [k, r.run.ledger(k)]));
    return { thrown: r.thrown, t: r.t, led, owl: r.owlTicks };
}
const a = digest(stage({ ...args, owl: false }));
const b = digest(stage({ ...args, owl: true }));
const h = (x) => createHash('md5').update(JSON.stringify(x)).digest('hex');
console.log('OFF', h(a), a.thrown?.slice(0, 200), a.t, 'hits', a.led.playerHits.length);
console.log('ON ', h(b), b.thrown?.slice(0, 200), b.t, 'hits', b.led.playerHits.length);
for (let i = 0; i < Math.max(a.owl.length, b.owl.length); i += 1) {
    if (JSON.stringify(a.owl[i]) !== JSON.stringify(b.owl[i])) { console.log('first owlTicks diff', i, a.owl[i], b.owl[i]); break; }
}
console.log('playerHits OFF', JSON.stringify(a.led.playerHits.map((x) => [x.t, x.source, x.hits])));
console.log('playerHits ON ', JSON.stringify(b.led.playerHits.map((x) => [x.t, x.source, x.hits])));
