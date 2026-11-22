// The player's lava swim speed off the repo's port (playerPhysicsV1.step), with and without the swim boost
// (Player.as:548 `moveSpeeds[state] + 0.25 * int(Music.soundPosition("Swim") < 0.1)`: 6 of the 47 frames of swim.mp3,
// Music.as:540; replayed while v.length > 0, Player.as:549-551), axis and diagonal; and the lavarunner off chasers.chaserStep.
const R = new URL('../../../../../', import.meta.url).pathname;
const PP = await import(R + 'frontend/modules/seedlingDemo/playerPhysicsV1.js');
const { chaserStep } = await import(R + 'frontend/modules/seedlingDemo/chasers.js');
const KG = await import(R + 'scripts/procgen/seedlingChaserPursuitGuard.js');
const BOOST = 0.25, BOOST_FRAMES = 6, LEN = 47;
function player(keys, { boost, ticks = 1200, warm = 120 }) {
    let s = { x: 5e4, y: 5e4, vx: 0, vy: 0 }; let x0, y0; let ph = 0;
    for (let t = 0; t < ticks; t += 1) {
        if (t === warm) { x0 = s.x; y0 = s.y; }
        const moveSpeed = PP.MOVE_SPEEDS[17] + (boost && ph < BOOST_FRAMES ? BOOST : 0);
        s = { ...s, ...PP.step(s, new Set(keys), { world: { width: 1e5, height: 1e5 }, moveSpeed, friction: PP.WATER_FRICTION }) };
        ph = (ph + 1) % LEN;
    }
    const n = ticks - warm; return { axis: Math.abs(s.x - x0) / n, euclid: Math.hypot(s.x - x0, s.y - y0) / n };
}
function runner(dir, moveSpeed, { ticks = 1200, warm = 120 } = {}) {
    let e = { x: 0, y: 0, v: { x: 0, y: 0 }, moveSpeed, runRange: 1e9 }; let x0, y0;
    for (let t = 0; t < ticks; t += 1) {
        if (t === warm) { x0 = e.x; y0 = e.y; }
        const r = chaserStep('lavarunner', e, { x: e.x + dir[0] * 1e6, y: e.y + dir[1] * 1e6 }, { onScreen: true });
        e = { ...e, x: r.x, y: r.y, v: r.v };
    }
    const n = ticks - warm; return Math.hypot(e.x - x0, e.y - y0) / n;
}
console.log('MOVE_SPEEDS[17] =', PP.MOVE_SPEEDS[17], 'WATER_FRICTION =', PP.WATER_FRICTION);
console.log('K (b) playerSpeedOn(17) =', KG.playerSpeedOn(17).toFixed(4), ' bodySpeedOn(lavarunner,17) =', KG.bodySpeedOn('lavarunner', 17).toFixed(4));
for (const boost of [false, true]) {
    const a = player(['right'], { boost }), d = player(['right', 'down'], { boost });
    console.log(`player lava, boost=${boost}: axis ${a.euclid.toFixed(4)}  diagonal ${d.euclid.toFixed(4)} (per axis ${d.axis.toFixed(4)})`);
}
console.log(`lavarunner swim (moveSpeed 1): axis ${runner([1, 0], 1).toFixed(4)} diagonal ${runner([1, 1], 1).toFixed(4)}`);
console.log(`lavarunner walk (moveSpeed 1.5): axis ${runner([1, 0], 1.5).toFixed(4)} diagonal ${runner([1, 1], 1.5).toFixed(4)}`);
const wa = player(['right'], { boost: false }); 
