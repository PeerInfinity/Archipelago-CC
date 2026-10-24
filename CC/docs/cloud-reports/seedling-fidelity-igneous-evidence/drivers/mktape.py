import json,sys
def tape(name, boot, inputs, tick_count, desc=''):
    items = {k: False for k in ["hasSword","hasGhostSword","hasShield","hasFire","hasWand","hasFireWand","canSwim","hasSpear","hasDarkShield","hasDarkSuit","hasDarkSword","hasFeather","hasTorch"]}
    for k in ["hasSword","hasShield","hasFire","hasWand","hasSpear","hasDarkShield","hasDarkSword","hasFeather","hasTorch","canSwim"]: items[k]=True
    return {"tape_version":8,"game":"seedling","boot":boot,"noclip":False,"noDamage":False,"noHazards":[],"grants":[],
      "persistence":[],"despawn":[],"equips":[],"pins":["sound","dead_frames"],
      "save":{"totem_parts":[],"keys":[],"seal_parts":[]},
      "rng":{"seed":418414780,"split":False,"cosmetic":0,"fp":1763053598},
      "seam":{"items":items,"beam":False,"rock_set":False,"hits_max":4,"first_use":False,"extended":False,"time":5790,
              "primary":0,"secondary":0,"grass_cut":0,"cutscene":[False]*4,"menu_state":0,"music":{"set":"Room","index":1}},
      "tick0":None,"hold":False,"tick_count":tick_count,"inputs":inputs,"name":name,"description":desc,"note":""}
def I(spec):
    out=[]
    for s in spec.split(','):
        s=s.strip(); k,r=s.split(); a,b=r.split('-'); out.append({"key":k,"from":int(a),"to":int(b)})
    out.sort(key=lambda d:(d['from'],d['key']))
    return out
if __name__=='__main__':
    L649 = I("primary 0-1, right 0-3, primary 2-3, left 3-4, right 4-9, primary 8-9, left 10-15, primary 14-15, right 15-17, right 19-21, primary 21-22, primary 23-24, left 24-28, right 28-29, left 29-30, up 34-50")
    json.dump(tape("igneous-l76-leg649", {"level":76,"x":16,"y":80}, L649, 90), open('/tmp/claude-0/s/tapes/leg649.json','w'), indent=1)
