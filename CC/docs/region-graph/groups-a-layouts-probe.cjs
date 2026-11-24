const fs=require('fs');const path=require('path');
const L=(f)=>fs.readFileSync(path.join(process.argv[2],'frontend/libs/cytoscape',f),'utf8');
function umd(src, deps){const m={exports:{}};const req=(n)=>deps[n];new Function('module','exports','require',src)(m,m.exports,req);return m.exports;}
const cytoscape=umd(L('cytoscape.min.js'),{});
const layoutBase=umd(L('layout-base.js'),{});
const coseBase=umd(L('cose-base.js'),{'layout-base':layoutBase});
const fcose=umd(L('cytoscape-fcose.js'),{'cose-base':coseBase,'layout-base':layoutBase});
cytoscape.use(fcose);
const els=[];
for(let g=0;g<4;g++){els.push({data:{id:'G'+g},classes:'region-group'});for(let i=0;i<4;i++)els.push({data:{id:`r${g}_${i}`,parent:'G'+g},classes:'region'});}
for(let i=0;i<3;i++)els.push({data:{id:'solo'+i},classes:'region'});
let e=0;const add=(a,b)=>els.push({data:{id:'e'+(e++),source:a,target:b}});
for(let g=0;g<4;g++){for(let i=0;i<3;i++)add(`r${g}_${i}`,`r${g}_${i+1}`);add(`r${g}_3`,`r${(g+1)%4}_0`);}add('solo0','r0_0');add('solo1','solo0');add('solo2','r2_2');
for(const name of ['fcose','cose','breadthfirst','circle','grid','concentric','random','preset']){
  const cy=cytoscape({headless:true,styleEnabled:true,elements:JSON.parse(JSON.stringify(els))});
  cy.style().selector('node').style({width:60,height:45}).update();
  let err=null;try{const opts={name,animate:false,randomize:true};if(name==='preset')opts.positions=(n)=>({x:Math.random()*500,y:Math.random()*500});if(name==='breadthfirst')opts.roots='#solo1';cy.layout(opts).run();}catch(x){err=x.message;}
  // overlap between group boxes
  const bbs=cy.nodes('.region-group').map(n=>n.boundingBox());
  let overlaps=0;for(let i=0;i<bbs.length;i++)for(let j=i+1;j<bbs.length;j++){const a=bbs[i],b=bbs[j];if(a.x1<b.x2&&b.x1<a.x2&&a.y1<b.y2&&b.y1<a.y2)overlaps++;}
  // non-members inside a box
  let intruders=0;cy.nodes('.region').forEach(n=>{const p=n.position();cy.nodes('.region-group').forEach(g=>{if(n.parent().id()===g.id())return;const b=g.boundingBox();if(p.x>b.x1&&p.x<b.x2&&p.y>b.y1&&p.y<b.y2)intruders++;});});
  const nan=cy.nodes().some(n=>!Number.isFinite(n.position().x));
  console.log(name.padEnd(13), err?('ERROR '+err):'ok', 'boxOverlaps='+overlaps, 'foreignNodesInBoxes='+intruders, nan?'NaN!':'');
}
process.exit(0);
