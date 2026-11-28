const L = await import('/home/user/Archipelago-CC/frontend/modules/seedlingDemo/hammerStep189Legs.js');
for (const [n, r] of [['38:6', L.REQ_38_6], ['39:1', L.REQ_39_1]]) for (const on of [false, true]) {
  const t0 = Date.now(); const o = L.solveStep189(r, on); console.log(n, on, Date.now() - t0, JSON.stringify({ ...o, message: o.message?.slice(0, 200) }));
}
