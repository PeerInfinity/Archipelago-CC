# cut a captured leg's request to level-40 atlas records (BX's hammer-bx-371 shape): {id, key, requests:[{i, request}]}
import json,gzip,sys
cap,leg,i,out=sys.argv[1],int(sys.argv[2]),int(sys.argv[3]),sys.argv[4]
row=[json.loads(l) for l in open(cap) if json.loads(l)['id']==leg][0]
q=row['requests'][i]['request']
q['source']['records']['__map']=[e for e in q['source']['records']['__map'] if e[0]==40]
o={'id':row['id'],'key':row['key'],'requests':[{'i':i,'request':q}]}
open(out+'.jsonl','w').write(json.dumps(o)+'\n')
gzip.open(out,'wb',compresslevel=9).write(json.dumps(o).encode())
