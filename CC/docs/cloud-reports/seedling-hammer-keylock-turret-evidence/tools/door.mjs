const R='/home/user/Archipelago-CC/';const M=R+'frontend/modules/seedlingDemo/';
const {restoreRequest}=await import(R+'scripts/procgen/seedlingSolveRequestCodec.js');
const {levelSourceFromAtlas}=await import(M+'atlasSource.js');
const {replayTape}=await import(M+'jsRuntimeSolver.js');
const fs=await import('fs');
const [file,id,persist]=process.argv.slice(2);
for(const l of fs.readFileSync(file,'utf8').trim().split('\n')){const r=JSON.parse(l);if(String(r.id)!==id)continue;
const q=restoreRequest(r.requests[0].request);
const st={...q.staging}; if(persist) st.persistence=[...(st.persistence??[]),...persist.split(',').map(s=>{const[level,tag]=s.split(':').map(Number);return{level,tag}})];
const run=replayTape({staging:st,perTick:[],levelSource:levelSourceFromAtlas(q.source.records)});
for(let i=0;i<=200;i++){ if(i%20===0) console.log(i,[...run.entities('openActivators')].join(',')); run.advance(new Set()); }
}
