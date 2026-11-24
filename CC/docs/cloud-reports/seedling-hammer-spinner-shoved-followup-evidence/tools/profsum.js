const p=JSON.parse(require('fs').readFileSync(process.argv[2]));const byId=new Map(p.nodes.map(n=>[n.id,n]));
const dt=p.timeDeltas;const cnt=new Map();p.samples.forEach((s,i)=>cnt.set(s,(cnt.get(s)||0)+(dt[i]||0)));
const parent=new Map();p.nodes.forEach(n=>(n.children||[]).forEach(c=>parent.set(c,n.id)));
const incl=new Map();for(const [id,t] of cnt){let cur=id;const seen=new Set();while(cur!==undefined){const n=byId.get(cur);const f=n.callFrame.functionName+':'+n.callFrame.url.split('/').pop();if(!seen.has(f)){seen.add(f);incl.set(f,(incl.get(f)||0)+t);}cur=parent.get(cur);}}
[...incl].filter(([k])=>k.includes('solverBot')||k.includes('jsRuntime')).sort((a,b)=>b[1]-a[1]).slice(0,45).forEach(([k,t])=>console.log((t/1e6).toFixed(1),k));
