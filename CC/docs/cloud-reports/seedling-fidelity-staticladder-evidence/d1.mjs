// D1: sub-classify the combat-ladder EXHAUSTED rows (survey 38010117701 + sweep-3 38010249317).
import fs from 'node:fs';
import { ENEMY_CLASSES, contactPricing } from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/combat.js';
import { isBridgedChaser } from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/chasers.js';
import { atlasLevelSource } from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/levelSource.js';
import { buildLevelWorld } from '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/levelWorld.js';
const src = atlasLevelSource();
const worlds = new Map();
const W = (L) => { if (!worlds.has(L)) worlds.set(L, buildLevelWorld(src(L), {})); return worlds.get(L); };
const GAME = {
  sandtrap: 'static; contact 16x16 at centre; sword/arrow-killable (hitsMax 3); chomps at 20 px (visual)',
  darktrap: 'static; contact as SandTrap; hit() EMPTY (weapon-immune); dies when a lit non-dark Light is within radiusMin (28) — a LightPole lit by a Spear/ghost-sword hit; harmless from that tick (update skips Enemy.update)',
  bulb: 'Bob subclass: CHASES (moveSpeed 0.65), hitsMax 1, death drops lava on its tile',
  lavarunner: 'Bob subclass: CHASES (1.5 walk / 1 swim), swims lava, hitsMax 2',
  turret: 'static body that shoots spit; contact as Enemy',
  drill: 'hopping body (drillLive bridge)',
  puncher: 'chaser with a punch box (bridged)',
  crusher: 'ceiling crusher, trigger lane',
  bob: 'Bob chaser (bridged)', bobsoldier: 'BobSoldier (BOBSOLDIER2 region)', spinner: 'Spinner billiard (bridged)',
  spinningaxe: 'hazard (hammer arc)',
};
const RUNG = {
  sandtrap: 'kill: STATIC arm (sword/arrow — F4 computes SandTrap) but the arm is reached only when chooseBodyToRemove returns a stepped===false body, i.e. never in a STEPPED room',
  darktrap: 'kill: a LIGHT arm (Spear/ghost-sword hit on the LightPole within 28 px) — NO such arm exists',
  bulb: 'bridge (CHASERS row) then bait/kill(chaser)', lavarunner: 'bridge (K2 KILLLOCK arm, OFF pending a game witness) then bait/kill',
  turret: 'avoid/dodge (spit timing) — a turret is not on the corridor; see refusal', drill: 'drill kill/dodge',
  puncher: 'avoid failed on CONNECTIVITY (tiles in different components), not on the punch', crusher: 'CRUSHER_BAIT / hold-stance timing',
  bob: 'chaser arm', bobsoldier: 'BOBSOLDIER2', spinner: 'press arm (hammer arc)', spinningaxe: 'dodge (hammer arc)',
};
const out = [];
const bodyOf = (txt) => {
  const m = txt.match(/passes through danger at \(([^)]*)\) — (.*?) \(/s);
  return m ? { at: m[1], ids: [...txt.split('— and every rung')[0].matchAll(/(enemy|chaser|crusher|hazard|spinner):([a-z]+)@(\d+),(\d+)/g)].map(x => ({ kind: x[1], tag: x[2], x: +x[3], y: +x[4] })) } : null;
};
const add = (source, key, level, txt, items) => {
  const b = bodyOf(txt); const first = b?.ids[0];
  const tag = first?.tag ?? '?';
  const row = ENEMY_CLASSES[tag];
  const pricing = row ? contactPricing(tag) : { kind: 'n/a' };
  const avoid = (txt.match(/avoid: ([^\n]*)/)?.[1] ?? '').slice(0, 90);
  const avoidKind = /different connected components/.test(avoid) ? 'components' : /goal tile .* not walkable/.test(avoid) ? 'goal-tile-forbidden' : /STILL probes/.test(avoid) ? 'probe-still-dangerous' : avoid ? 'other' : '-';
  let pole = null;
  if (tag === 'darktrap') {
    const poles = W(level).pressResponders.filter((r) => r.as3 === 'LightPole');
    const cx = first.x + 8, cy = first.y + 8;
    const d = poles.map((p) => ({ id: `lightpole@${p.x},${p.y}`, d: Math.hypot(p.x + 8 - cx, p.y + 8 - cy) })).sort((a, z) => a.d - z.d)[0];
    pole = d ? `${d.id} ${d.d.toFixed(1)}px` : 'none';
  }
  out.push({ source, key, level, cls: tag, kind: first?.kind, all: b?.ids.map(i => `${i.tag}@${i.x},${i.y}`).join('+'), as3: row?.as3 ?? '-', bridged: isBridgedChaser(tag), pricing: pricing.kind, avoidKind,
    spear: items?.hasSpear ?? null, ghost: items?.hasGhostSword ?? null, pole, game: GAME[tag] ?? '?', rung: RUNG[tag] ?? '?' });
};
const s = JSON.parse(fs.readFileSync('/home/user/Archipelago-CC/.cache/seedling-survey/through-end/survey.json', 'utf8'));
for (const r of s.rows) if (/ladder is EXHAUSTED/.test(r.refusal ?? '')) {
  const g = r.boot?.saveGrant ?? {}; const it = Object.fromEntries([...(g.items ?? []), ...(g.latched ?? [])].map(k => [k, true]));
  add('survey', `step ${r.step}`, r.level, r.refusal, { hasSpear: !!it.hasSpear, hasGhostSword: !!it.hasGhostSword });
}
for (const line of fs.readFileSync('/tmp/claude-0/sweep3/divergence-merged/merged/rows.jsonl', 'utf8').trim().split('\n')) {
  const r = JSON.parse(line); const t = JSON.stringify(r.failed ?? ''); if (!/ladder is EXHAUSTED/.test(t)) continue;
  add('sweep', `leg ${r.id}`, r.level, JSON.parse(t), r.items);
}
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
const fam = {};
for (const o of out) { const k = o.cls; fam[k] ??= { survey: 0, sweep: 0, levels: new Set() }; fam[k][o.source] += 1; fam[k].levels.add(o.level); }
console.log('| class | survey | sweep | levels | as3 | bridged | contactPricing |');
for (const [k, v] of Object.entries(fam).sort((a, b) => (b[1].survey + b[1].sweep) - (a[1].survey + a[1].sweep))) {
  const o = out.find(x => x.cls === k); console.log(`| ${k} | ${v.survey} | ${v.sweep} | ${[...v.levels].join(',')} | ${o.as3} | ${o.bridged} | ${o.pricing} |`);
}
console.log('\nrows:');
for (const o of out) console.log(`${o.source} ${o.key} L${o.level} ${o.all} pricing=${o.pricing} bridged=${o.bridged} avoid=${o.avoidKind} spear=${o.spear} ghost=${o.ghost} ${o.pole ?? ''}`);
