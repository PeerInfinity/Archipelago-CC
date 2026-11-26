const R = '/home/user/Archipelago-CC/frontend/modules/seedlingDemo/';
const { solveCapturedP1 } = await import(R + 'hammerBridgeOpenStrayRows.js');
const sb = await import(R + 'solverBot.js');
for (const on of [false, true]) {
  sb.resetBridgeOpenStrayCounts();
  const r = sb.withBridgeOpenStray(on, () => solveCapturedP1());
  console.log(on ? 'ON ' : 'OFF', JSON.stringify({ ...r, message: r.message?.slice(0, 200) }), JSON.stringify(sb.BRIDGE_OPEN_STRAY_COUNTS));
}
