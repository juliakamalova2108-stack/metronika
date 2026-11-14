import json,re,collections
res=json.load(open('/tmp/sc/res.json')); sc=json.load(open('/tmp/sc/screens.json'))
norm=lambda t:re.sub(r'[   ]',' ',t)
fmt=lambda n:f"{n:,}".replace(',',' ')
O=res['orders']; log=res['log']; bad=collections.defaultdict(list)
logby=collections.defaultdict(list)
for x in log: logby[(x['no'],x['kind'])].append(x)
# I1 stage tabs
tabs={t:norm(v) for t,v in sc['tabs'].items()}
for o in O:
    st=o['st']; n=o['name']
    where=[t for t,txt in tabs.items() if n in txt] if len(n)<60 else []
    short=n[:20]
    where=[t for t,txt in tabs.items() if (f"№{o['no']}" in txt)]
    if st not in where: bad['I1 вкладка'].append(f"{o['sc']}.{o['v']} №{o['no']} st={st} видно в {where}")
    if len(where)>1: bad['I1 дубль во вкладках'].append(f"{o['sc']}.{o['v']} №{o['no']} {where}")
    if o['exp']['st'] != st and o['sc'] not in ('B14',): bad['I0 состояние'].append(f"{o['sc']}.{o['v']} ждали {o['exp']['st']} получили {st}")
# I3/I4 statsLog
for o in O:
    e=o['exp']; d=logby.get((o['no'],'done')); l=logby.get((o['no'],'lost'))
    if o['st']=='done':
        if not d: bad['I3 нет записи done'].append(f"{o['sc']}.{o['v']} №{o['no']}")
        elif d[0]['sum']!=e['done']: bad['I3 сумма done'].append(f"{o['sc']}.{o['v']} №{o['no']} лог {d[0]['sum']} ждали {e['done']}")
    elif o['st']=='refused':
        if not l: bad['I3 нет записи lost'].append(f"{o['sc']}.{o['v']} №{o['no']}")
        elif e['lost'] is not None and l[0]['sum']!=e['lost']: bad['I3 сумма lost'].append(f"{o['sc']}.{o['v']} №{o['no']} лог {l[0]['sum']} ждали {e['lost']}")
    else:
        if d or l: bad['I4 запись в нефинальном'].append(f"{o['sc']}.{o['v']} №{o['no']} st={o['st']}")
# done с нулевой суммой
for x in log:
    if x['kind']=='done' and x['sum']==0: bad['I3b done на 0 ₽ (все комнаты отказаны)'].append(f"№{x['no']}")
# I2 клиенты
cl=norm(sc['clients']); 
nc=int(re.search(r'(\d+) клиент',cl).group(1))
phones=set(o['phone'] for o in O)
bad['I2 клиенты (инфо)'].append(f"всего клиентов {nc}, разных телефонов в тестах {len(phones)} (+8 демо)")
miss=[o for o in O if o['name'][:15] not in cl and len(o['name'])>0]
if miss: bad['I2 клиент не виден'].append(', '.join(f"{o['sc']}.{o['v']}" for o in miss[:12])+f" (всего {len(miss)})")
# повторные клиенты: дубль телефона = один клиент
dup=collections.Counter(o['phone'] for o in O); print('дублей телефона:',sum(1 for p,c in dup.items() if c>1))
# черновики
for k in ['ЧЕРНОВИК-А1','ЧЕРНОВИК-А2']:
    for h in ['clients','orders','stats','home']:
        if k in sc[h] or k in ''.join(tabs.values()): bad['A черновик просочился'].append(f"{k} в {h}")
# I5 страница done: сумма
for o in O:
    p=norm(sc['pages'][o['no']])
    for w in ['undefined','NaN','Infinity','null','[object']:
        if w in p: bad['I6 мусор на странице'].append(f"{o['sc']}.{o['v']} №{o['no']} содержит {w}")
    if o['st']=='done' and o['exp']['done'] and fmt(o['exp']['done']) not in p: bad['I5 сумма не на странице done'].append(f"{o['sc']}.{o['v']} №{o['no']} ждали {fmt(o['exp']['done'])}; на странице {re.findall(r'\d[\d ]{3,} ₽',p)[:3]}")
# stats income delta
def inc(t):
    m=re.search(r'Доход\n\s*([\d  ]+) ₽',norm(t)); return int(m.group(1).replace(' ','')) if m else None
b=inc(sc['stats_base']); a=inc(sc['stats']); exp=sum(x['sum'] for x in log if x['kind']=='done')
bad['I7 доход (инфо)'].append(f"база {b}, после {a}, дельта {None if b is None or a is None else a-b}, ждали {exp}")
if b is not None and a is not None and a-b!=exp: bad['I7 доход НЕ СОШЁЛСЯ'].append(f"дельта {a-b} != {exp}")
lostexp=sum(1 for x in log if x['kind']=='lost')
print('reload:',sc['reload'])
for k,v in sorted(bad.items()): print(f"\n[{k}] {len(v)}"); [print('  ',x) for x in v[:8]]
print('\nнеизвестные заметки:',res['notes'][3:8])
