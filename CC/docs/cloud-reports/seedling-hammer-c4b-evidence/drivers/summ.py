import json,glob,os
rows=[]
for f in sorted(glob.glob('runs/m-*.json')):
    tag=os.path.basename(f)[:-5]
    try: r=json.load(open(f))
    except Exception as e: print(tag,'ERR',open(f.replace('.json','.err')).read()[-300:]); continue
    sink=[json.loads(l) for l in open(f.replace('.json','.sink.jsonl')) if l.strip()] if os.path.exists(f.replace('.json','.sink.jsonl')) else []
    fires=[c for c in sink if c.get('chooser') and (c.get('headProbe') or {}).get('hit') and any(s['id'] not in c['chooser'] for s in c['headProbe']['sources'])]
    fs=sorted({(c['level'],c['chooser'][0],','.join(s['kind']+':'+s['id'] for s in c['headProbe']['sources'])) for c in fires})
    v = f"DONE {r['ticks']}t hits={r['hits']} verbs={r['verbs']} md5={r['solutionMd5'][:8]}" if r['ok'] else f"REFUSED {r['message'][:150]}"
    print(f"{tag:22s} climbs={len(sink):3d} fires={len(fires):3d} {fs} | {v}")
