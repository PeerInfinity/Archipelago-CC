"""MEASURE ONLY (slice rules-model-coverage-inventory, 2026-10-05). Renders the report's markdown tables from
coverage.json, so every number in the report is a script output. Usage: render_tables.py <coverage.json> > tables.md"""
import json,sys
d=json.load(open(sys.argv[1])); C=d['c_entityClasses']
def rl(xs,n=14): xs=list(xs); return ','.join(map(str,xs[:n]))+('…' if len(xs)>n else '')
P=print
st={}
for c in C['classes']: st.setdefault(c['model']['status'],[]).append(c)
P('### Status totals\n')
P('| status | classes | placed classes | placements |\n|---|---|---|---|')
for s in ['transcribed','partial','refused','absent','n/a','UNGRADED']:
    cs=st.get(s,[])
    if cs: P(f"| {s} | {len(cs)} | {sum(1 for c in cs if c['placements'])} | {sum(c['placements'] for c in cs)} |")
P(f"\nFactory tags {C['factoryTags']}; atlas tags {C['atlasTags']}; level-property tags not built by `new`: {', '.join(C['tagsNotInFactory'])}; factory tags no vanilla room places: {', '.join(C['factoryTagsNotInAtlas'])}.\n")
P('### Placed classes the model does not fully cover\n')
P('| AS3 class | tags | placed / rooms | rooms | gaps (model) | rules row(s) | survey rooms | refusals NAMING it | sphere rooms | I1 rows |\n|---|---|---|---|---|---|---|---|---|---|')
for c in sorted([c for c in C['classes'] if c['placements'] and c['model']['status']!='transcribed'], key=lambda c:(-len(c['route']['namedByRefusal']),-len(c['route']['surveyRooms']),-c['placements'])):
    gaps='; '.join(g for g in c['model']['gaps'] if 'unreachable state' not in g) or '—'
    rules='; '.join(f"{r['tag']}={r['semantics']}{'+ov:'+r['overlay'] if r['overlay'] else ''}" for r in c['rules'])
    P(f"| **{c['as3']}** | {','.join(c['tags'])} | {c['placements']}/{len(c['rooms'])} | {rl(c['rooms'])} | {gaps} | {rules} | {rl(c['route']['surveyRooms'])} | {rl(c['route']['namedByRefusal'],8) or '—'} | {rl(c['route']['sphereRooms'])} | {','.join(c['i1Rows']) or '—'} |")
P('\n### Transcribed classes that survey refusals still NAME (the verb/encounter is the gap, not the transcription)\n')
for c in sorted([c for c in C['classes'] if c['model']['status']=='transcribed' and c['route']['namedByRefusal']],key=lambda c:-len(c['route']['namedByRefusal'])):
    P(f"- **{c['as3']}** ({','.join(c['tags'])}): {len(c['route']['namedByRefusal'])} — {rl(c['route']['namedByRefusal'],10)}")
P('\n### Runtime-only classes (no vanilla placement), graded by hand with the citation\n')
P('| AS3 class | grade | origin | spawned at | citation |\n|---|---|---|---|---|')
for c in sorted([c for c in C['classes'] if not c['placements']], key=lambda c:(c['model']['status'],c['as3'])):
    P(f"| {c['as3']} | {c['model']['status']} | {c['origin']} | {rl(c['runtimeSpawnSites'],3)} | {c['model']['grade'] or '—'} |")
P('\n### Transcribed placed classes (footprint + behaviour, no refusal axis)\n')
tc=[c for c in C['classes'] if c['placements'] and c['model']['status']=='transcribed']
P(', '.join(f"{c['as3']} ({c['placements']})" for c in sorted(tc,key=lambda c:-c['placements'])))
# survey
A=d['a_survey']
P(f"\n### Survey verdicts ({A['steps']} steps)\n")
P(' · '.join(f'{k} {v}' for k,v in A['verdicts'].items()))
P('\n| family (the survey\'s own) | sub-family | owner | steps | rooms | site |\n|---|---|---|---|---|---|')
for f in A['families']:
    P(f"| {f['family']} | {f['sub']} | {f['owner']} | {f['steps']} | {rl(f['rooms'],20)} | {' '.join(f['site'][:2]) or '—'} |")
