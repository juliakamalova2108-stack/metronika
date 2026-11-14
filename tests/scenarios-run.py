import asyncio, json, re
from playwright.async_api import async_playwright
V=open('/home/claude/metronika/version.txt').read().strip()
JS=open('/tmp/sc/seed.js').read().replace('__V__',V)
async def main():
    errs=[]
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome')
        pg=await b.new_page(viewport={'width':390,'height':844})
        pg.on('pageerror',lambda e:errs.append('PAGEERR '+str(e)))
        pg.on('console',lambda m:errs.append('CONSOLE '+m.text) if m.type=='error' and 'audio' not in m.text and '404' not in m.text else None)
        await pg.goto(f'http://localhost:8780/index.html?demo=1&v={V}'); await pg.wait_for_timeout(1500)
        await pg.evaluate("location.hash='#stats'"); await pg.wait_for_timeout(700)
        base=await pg.evaluate("document.body.innerText")
        res=await pg.evaluate(JS)
        json.dump(res,open('/tmp/sc/res.json','w'),ensure_ascii=False,indent=1)
        print('orders',len(res['orders']),'log',len(res['log']),'notes',res['notes'][:6])
        out={'stats_base':base}
        for h in ['home','orders','clients','stats','calendar']:
            await pg.evaluate(f"location.hash='#{h}'"); await pg.wait_for_timeout(600)
            out[h]=await pg.evaluate("document.body.innerText")
        # вкладки
        await pg.evaluate("location.hash='#orders'"); await pg.wait_for_timeout(500)
        tabs=await pg.evaluate("[...document.querySelectorAll('[data-action=bd-stage]')].map(a=>a.dataset.stage)")
        out['tabs']={}
        for t in tabs:
            await pg.evaluate("s=>document.querySelector('[data-action=bd-stage][data-stage='+s+']').click()",t); await pg.wait_for_timeout(350)
            out['tabs'][t]=await pg.evaluate("document.querySelector('.bd-list').innerText")
        # страницы заказов
        out['pages']={}
        for o in res['orders']:
            await pg.evaluate(f"location.hash='#bd-order-{o['no']}'"); await pg.wait_for_timeout(120)
            out['pages'][o['no']]=await pg.evaluate("document.body.innerText")
        # перезагрузка
        before=await pg.evaluate("JSON.stringify(Object.fromEntries((JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>/metron/i.test(k))||'')||'{}').myOrders||[]).map(n=>[n,1])))")
        await pg.reload(); await pg.wait_for_timeout(1500)
        out['reload']=await pg.evaluate("import('./js/store.js?v=%s').then(S=>JSON.stringify({my:(S.get().myOrders||[]).length,log:(S.get().statsLog||[]).length}))"%V)
        json.dump(out,open('/tmp/sc/screens.json','w'),ensure_ascii=False)
        await b.close()
    json.dump(errs,open('/tmp/sc/errs.json','w'),indent=1)
    print('errors',len(errs)); print('\n'.join(sorted(set(errs))[:12]))
asyncio.run(main())
