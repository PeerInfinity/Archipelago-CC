import json,sys
for l in sys.stdin:
    s=json.loads(l)
    print('##',s['wl'],s['derivations'],'cont',s['cont'],'refusedOFF',s.get('refused_off'))
    for v in s.get('variants',[]):
        print(f"{v:9}", s.get('cat_'+v), 'aLost',s.get('aLost_'+v), 'prev',s['previews_'+v],'ms',s['ms_'+v], round(s['ms_'+v]/max(s['ms_off'],1e-9),2))
