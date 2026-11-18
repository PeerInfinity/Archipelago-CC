const M = (p) => import(process.cwd() + '/frontend/modules/seedlingDemo/' + p);
const { l25Sets } = await M('fidelityL25ApItem.js'); const SRC = l25Sets(process.cwd()).deliveredSource; const atlasLevelSource = () => SRC; const { createRunForStaging } = await M('tapeRunner.js');
const { solveSegment, withFrontierDoorRoute, FRONTIER_DOOR_ROUTE } = await M('solverBot.js');
const [bx, by] = process.argv.slice(2).map(Number);
const staging = {"boot":{"level":12,"x":bx,"y":by},"noclip":false,"noDamage":false,"noHazards":[],"grants":[],"persistence":[],"despawn":[],"equips":[],"pins":["sound","dead_frames"],"save":{"totem_parts":[],"keys":[0,1],"seal_parts":[0,1,2,3,4,5]},"rng":{"seed":404717770,"split":true,"cosmetic":0},"seam":{"items":{"hasSword":true,"hasGhostSword":false,"hasShield":true,"hasFire":true,"hasWand":false,"hasFireWand":false,"canSwim":false,"hasSpear":false,"hasDarkShield":false,"hasDarkSuit":false,"hasDarkSword":false,"hasFeather":false,"hasTorch":true},"beam":false,"rock_set":false,"hits_max":3,"time":5203,"primary":0,"secondary":0,"cutscene":[false,false,false,false],"menu_state":0},"inventory_slots":[0,1]};
for (const on of [false, true]) {
  const run = createRunForStaging(staging, atlasLevelSource()); let n = 0; const adv = run.advance.bind(run); run.advance = (...a) => { n++; return adv(...a); };
  const t0 = Date.now(); let err = null;
  withFrontierDoorRoute(on, () => { try { solveSegment({ run, goals: [{ kind: 'collect-placement', placement: { x: 320, y: 816 } }], name: 'l12', boot: staging.boot }); } catch (e) { err = e; } });
  console.log(on, err ? String(err.message).slice(0, 200) : 'ok', 'ticks', n, run.state.x.toFixed(1), run.state.y.toFixed(1), 'hits', run.ledger('playerHits').length, 'ms', Date.now() - t0, JSON.stringify(FRONTIER_DOOR_ROUTE.counts));
}
