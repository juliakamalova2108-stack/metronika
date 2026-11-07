// «Оформить заказ» → вкладка «Замер» (в открытом заказе — «Смета»). Функции и раскладка — как у Codex;
// вид — по согласованному макету «Замер — осовременить формы»: графитовый лист с закладками-каскадом, парящие плашки площадей,
// стена-миллиметровка с зелёной штриховкой, кнопки под своими колонками, размеры в сантиметрах, полёт ярлыка.
import {actions,changes,rerender,afterRender} from './core.js?v=140';
import * as S from './store.js?v=140';
import {oformitDraft} from './oformit.js?v=140';
import {estimateRooms,svcInfo,SVC_LIST,SHORT_NAMES,measurementRoomPicker,measurementServices,measurementStrip,measurementSettings} from './ocenka.js?v=140';
import {esc} from './ui.js?v=140';

// ---------- числа ----------
const n=x=>Number(x||0).toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2});
const rub=x=>Math.round(x).toLocaleString('ru-RU')+' ₽';
const parse=x=>Math.max(0,parseFloat(String(x).replace(',','.'))||0);
const cm=m=>m?String(Math.round(m*100)):'';          // метры → сантиметры для поля
const fromCm=v=>parse(v)/100;                        // сантиметры из поля → метры

// ---------- данные ----------
const state=d=>d.sm||(d.sm={view:'pick',rooms:{}});
const room=(s,key)=>{
  const r=s.rooms[key]||(s.rooms[key]={sameH:true,h:2.7,sameSvc:false,walls:[]});
  // старые записи хранили проём как { name, area }
  r.walls.forEach(w=>{w.opens=(w.opens||[]).map(o=>o.type?o:{...o,type:o.name||'Проём'});w.svcs=w.svcs||[];});
  return r;
};
const current=()=>{const d=oformitDraft(),s=state(d);return room(s,s.view)};
const save=()=>{S.save();rerender()};
const gross=(w,r)=>w.len*(r.sameH?r.h:w.h);
const holes=w=>w.opens.reduce((a,o)=>a+o.area,0);
const net=(w,r)=>Math.max(0,gross(w,r)-holes(w));
const cost=(w,r)=>w.svcs.reduce((a,id)=>a+Math.round(net(w,r)*svcInfo(id).price),0);
const short=id=>SHORT_NAMES[id]||svcInfo(id).name;
const button=(label,a,extra='')=>`<button type="button" data-action="mw-${a}" ${extra}>${label}</button>`;
const TRASH='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 4h6M6 7l1 13h10l1-13M10 11v6M14 11v6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

// ---------- закладки-каскад ----------
// светлый оттенок цвета комнаты для блика кромки
const light=c=>{const m=/^#?([0-9a-f]{6})$/i.exec(c||'');if(!m)return '#cfe0ff';const v=parseInt(m[1],16),f=x=>Math.round(x+(255-x)*.45);return `rgb(${f(v>>16&255)},${f(v>>8&255)},${f(v&255)})`;};
// Лист стены: выбранная закладка и пластина — один фон (.gt-sheet с вырезом по силуэту), остальные закладки — позади.
const H=44, SL=26, SEL_W=120, SUM_W=76, ROW_W=358;
function tabs(r,color){
  const n0=r.walls.length, sel=r.total?-1:r.active;
  const room=ROW_W-SUM_W-8-SEL_W-44;                     // место под остальные стены
  const step=n0>1?Math.max(18,Math.min(44,room/(n0-1))):44;
  const w=i=>i===sel?SEL_W:step+SL-2;
  const xs=[];let x=0;for(let i=0;i<n0;i++){xs.push(x);x+=w(i)-SL+2;}
  const plusX=x, plusW=64, leftW=plusX+plusW+2;
  const flag=(x0,ww)=>`M${x0} ${H} L${x0} 4 Q${x0} 0 ${x0+4} 0 L${x0+ww-SL} 0 L${x0+ww} ${H} Z`;
  // задние закладки: дальше от выбранной — ниже по слоям
  const order=[...Array(n0).keys()].filter(i=>i!==sel).sort((a,b)=>Math.abs(b-(sel<0?n0:sel))-Math.abs(a-(sel<0?n0:sel)));
  const back=`<path d="${flag(plusX,plusW)}" fill="#26353a" stroke="rgba(255,255,255,.18)"/>`+order.map(i=>`<path d="${flag(xs[i],w(i))}" fill="#26353a" stroke="rgba(255,255,255,.18)"/>`).join('');
  const lite=`<defs><linearGradient id="gtLite" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${color}"/><stop offset=".45" stop-color="${light(color)}"/><stop offset="1" stop-color="${color}" stop-opacity=".25"/></linearGradient></defs>`;
  const selLines=sel<0?'':`<path d="M${xs[sel]+.5} ${H} L${xs[sel]+.5} 4.5" stroke="rgba(255,255,255,.18)" fill="none"/><path d="M${xs[sel]+.8} 4.5 Q${xs[sel]+.8} .8 ${xs[sel]+4.5} .8 L${xs[sel]+SEL_W-SL} .8 L${xs[sel]+SEL_W} ${H}" fill="none" stroke="url(#gtLite)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
  const btn=(i)=>{const l=i===0||i===sel?xs[i]:Math.max(xs[i],xs[i-1]+w(i-1)-SL*.5);const rr=xs[i]+w(i)-SL*.55;
    return `<button type="button" class="gt-b${i===sel?' on':''}" data-action="mw-wall" data-i="${i}" style="left: ${Math.round(l)}px; width: ${Math.max(14,Math.round(rr-l))}px">${i===sel?'Стена ':''}${i+1}</button>`;};
  const plusL=n0?xs[n0-1]+w(n0-1)-SL*.5:0;
  const left=`<div class="gt-left" style="width: ${leftW}px"><svg class="gt-svg" width="${leftW}" height="${H}" viewBox="0 0 ${leftW} ${H}" aria-hidden="true">${back}</svg>`+
    `<svg class="gt-lines" width="${leftW}" height="${H}" viewBox="0 0 ${leftW} ${H}" aria-hidden="true">${lite}${selLines}</svg>`+
    r.walls.map((_,i)=>btn(i)).join('')+
    `<button type="button" class="gt-b add" data-action="mw-add-wall" aria-label="Добавить стену" style="left: ${Math.round(plusL)}px; width: ${Math.round(plusX+plusW-SL*.55-plusL)}px">+</button></div>`;
  const sumPath=`M0 ${H} L${SL} 0 L${SUM_W-4} 0 Q${SUM_W} 0 ${SUM_W} 4 L${SUM_W} ${H} Z`;
  const right=`<div class="gt-right" style="width: ${SUM_W}px">${r.total?`<svg class="gt-lines" width="${SUM_W}" height="${H}" viewBox="0 0 ${SUM_W} ${H}" aria-hidden="true">${lite}<path d="M.5 ${H} L${SL+.5} .8 L${SUM_W-4.5} .8 Q${SUM_W-.8} .8 ${SUM_W-.8} 4.5" fill="none" stroke="url(#gtLite)" stroke-width="1.6" stroke-linejoin="round"/></svg>`:`<svg class="gt-svg" width="${SUM_W}" height="${H}" viewBox="0 0 ${SUM_W} ${H}" aria-hidden="true"><path d="${sumPath}" fill="#26353a" stroke="rgba(255,255,255,.18)"/></svg>`}<button type="button" class="gt-b${r.total?' on':''}" data-action="mw-total" style="left: ${Math.round(SL*.6)}px; width: ${Math.round(SUM_W-SL*.6)}px">Итог</button></div>`;
  // силуэт листа: пластина + выбранная закладка (слева) или «Итог» (справа)
  const arc=(right)=>[0,15,30,45,60,75,90].map(a=>{const t=a*Math.PI/180,dx=24-24*Math.sin(t),dy=24-24*Math.cos(t);return right?`calc(100% - ${dx.toFixed(2)}px) ${(H+dy).toFixed(2)}px`:`${(24-24*Math.cos(t)).toFixed(2)}px ${(H+24-24*Math.sin(t)).toFixed(2)}px`;});
  let pts, glow, radius, edges;
  if(sel>=0){
    const x0=xs[sel];
    pts=[...(x0>0?[...arc(false),`${x0}px ${H}px`]:[]), `${x0}px 4px`,`${x0+1.2}px 1.2px`,`${x0+4}px 0`,`${x0+SEL_W-SL}px 0`,`${x0+SEL_W}px ${H}px`,...arc(true),'100% 100%','0 100%'];
    glow=`${x0+41}px ${H}px`; radius=`${x0>0?24:0}px 24px 24px 24px`;
    edges=(x0>0?`<i class="gt-edge" style="left: -1px; width: ${x0+1}px; border-left-width: 1px; border-top-left-radius: 24px"></i>`:'')+`<i class="gt-edge" style="left: ${x0+SEL_W-1}px; right: -1px; border-right-width: 1px; border-top-right-radius: 24px"></i>`;
  } else {
    pts=[...arc(false),`calc(100% - ${SUM_W}px) ${H}px`,`calc(100% - ${SUM_W-SL}px) 0`,`calc(100% - 4px) 0`,`calc(100% - 1.2px) 1.2px`,'100% 4px','100% 100%','0 100%'];
    glow=`calc(100% - 38px) ${H}px`; radius='24px 0 24px 24px';
    edges=`<i class="gt-edge" style="left: -1px; right: ${SUM_W-1}px; border-left-width: 1px; border-top-left-radius: 24px"></i>`;
  }
  const sheet=`<i class="gt-sheet" aria-hidden="true" style="clip-path: polygon(${pts.join(', ')}); background: radial-gradient(circle 260px at ${glow}, color-mix(in srgb, ${color} 42%, transparent), transparent), linear-gradient(180deg, #2f3f41 0, #2f3f41 ${H}px, #243133 340px, #1b2628 100%)"></i>`;
  return {html:sheet+`<nav class="gt-tabs" aria-label="Стены">${left}${right}</nav>`, radius, edges};
}

// ---------- итог комнаты (как у Codex) ----------
function summary(r,edges=''){
 let g=0,o=0,a=0,c=0;const by=new Map();
 const rows=r.walls.map((w,i)=>{const ga=gross(w,r),ho=holes(w),ne=net(w,r),co=cost(w,r);g+=ga;o+=ho;a+=ne;c+=co;w.svcs.forEach(id=>{const old=by.get(id)||{area:0,sum:0};old.area+=ne;old.sum+=Math.round(ne*svcInfo(id).price);by.set(id,old)});return '<section class="sum-wall"><div class="sum-wall-head"><strong>Стена '+(i+1)+'</strong><span>'+cm(w.len)+' × '+cm(r.sameH?r.h:w.h)+' см</span></div><div class="sum-wall-areas"><span>Общая <b>'+n(ga)+' м²</b></span><span>Проёмы <b>−'+n(ho)+' м²</b></span><span>Рабочая <b>'+n(ne)+' м²</b></span></div><div class="sum-details">'+w.opens.map(x=>'<div>'+esc(x.type)+' <span>'+(x.width&&x.height?cm(x.width)+' × '+cm(x.height)+' см · ':'')+n(x.area)+' м²</span></div>').join('')+w.svcs.map(id=>'<div>'+esc(svcInfo(id).name)+' <span>'+rub(Math.round(ne*svcInfo(id).price))+'</span></div>').join('')+'</div></section>'}).join('');
 return '<div class="wallbody room-summary">'+edges+'<div class="sum-heading"><div><small>ЗАМЕРЫ</small><h2>Итог по комнате</h2></div></div><div class="summary-areas"><span>S общая<b>'+n(g)+' м²</b></span><span>S проёмов<b>−'+n(o)+' м²</b></span><span>S рабочая<b>'+n(a)+' м²</b></span></div><div class="sum-section-title">Стены</div>'+rows+'<div class="sum-section-title">Работы по комнате</div><div class="sum-details sum-services">'+(Array.from(by,([id,v])=>'<div><span>'+esc(svcInfo(id).name)+'<small>'+n(v.area)+' м²</small></span><b>'+rub(v.sum)+'</b></div>').join('')||'<div>Работы пока не добавлены</div>')+'</div><div class="room-price"><span>Итого за работы</span><strong>'+rub(c)+'</strong></div></div>';
}

// ---------- карточка стены ----------
function card(w,r,edges){
  const list=t=>w.opens.filter(o=>t==='Окно'?o.type==='Окно':o.type!=='Окно');
  const hInput=r.sameH
    ?`<input aria-label="Высота стен комнаты, см" inputmode="numeric" value="${cm(r.h)}" placeholder="0" data-change="mw-roomheight">`
    :`<input aria-label="Высота этой стены, см" inputmode="numeric" value="${cm(w.h)}" placeholder="0" data-change="mw-height">`;
  return `<div class="wallbody">${edges}
  <section class="equation"><div class="eqplate gross"><b>S общая</b><strong>${n(gross(w,r))} м²</strong></div><div class="opgroup"><div class="caption">S проёмов ${n(holes(w))} м²</div><div class="operators"><span>−</span><span class="IC"></span><span>−</span><span class="IC"></span><span>=</span></div></div><div class="eqplate net"><div class="nettext"><b>S рабочая</b><strong>${n(net(w,r))} м²</strong></div></div></section>
  <section class="measurement">
    <div class="dimension"><i class="dimline"></i><label class="lengthfield"><input aria-label="Длина стены, см" inputmode="numeric" value="${cm(w.len)}" placeholder="0" data-change="mw-length"><span>см</span></label></div>
    <div class="drawing"><div class="heightdim"><label class="lengthfield hfield">${hInput}<span>см</span></label></div>
      <div class="joblist">${w.svcs.map(id=>`<button type="button" class="job" data-action="mw-services"><span>${esc(short(id))}</span><b>${rub(net(w,r)*svcInfo(id).price)}</b></button>`).join('')||'<span class="job-empty">Добавьте работу</span>'}</div>
      <div class="opening-columns">${['Окно','Дверь'].map((t,k)=>`<button type="button" class="opening-shape ${k?'door':'win'}" data-action="mw-openings" data-type="${t}" aria-label="${k?'Двери и проёмы':'Окна'}: открыть список"><span class="opening-values">${list(t).map(o=>`<span>${n(o.area)} м²</span>`).join('')}</span></button>`).join('')}</div>
    </div>
    <div class="under">
      ${button('<span class="u-plus"></span>Услуги','services','class="u-btn u-svc" data-fly-src="svc"')}
      <div class="under__ops">
        ${button('<span class="u-plus"></span>','add-opening','class="u-btn u-op" data-fly="win" data-fly-src="win" data-type="Окно" aria-label="Добавить окно"')}
        ${button('<span class="u-plus"></span>','add-opening','class="u-btn u-op" data-fly="door" data-fly-src="door" data-type="Дверь" aria-label="Добавить дверь"')}
      </div>
    </div>
  </section>
  ${holes(w)>gross(w,r)?'<p class="emptywarn">Площадь проёмов больше площади стены</p>':''}
  <div class="wall-card-tools">${button(TRASH,'delete-wall','class="wall-delete" aria-label="Удалить стену"')}</div>
  <footer class="footer footer--sum"><span>Итого по стене</span><b>${rub(cost(w,r))}</b></footer>
</div>`;
}

// ---------- окна поверх экрана ----------
function listDialog(r,w,color){
  const t=r.mwDialog;
  const rows=w.opens.map((o,k)=>({...o,k})).filter(o=>t==='Окно'?o.type==='Окно':o.type!=='Окно').map(o=>`<article class="opening-list-row"><div class="opening-row-title"><b>${esc(o.type)}</b><strong>${n(o.area)} м²</strong></div><div class="opening-row-fields"><label>Ширина, см<input aria-label="Ширина проёма ${o.k+1}, см" inputmode="numeric" value="${cm(o.width)}" data-change="mw-opening" data-k="${o.k}" data-field="width"></label><span>×</span><label>Высота, см<input aria-label="Высота проёма ${o.k+1}, см" inputmode="numeric" value="${cm(o.height)}" data-change="mw-opening" data-k="${o.k}" data-field="height"></label>${button('Удалить','delete-opening',`class="remove-opening" data-k="${o.k}"`)}</div></article>`).join('')||'<p class="mw-none">Проёмов пока нет</p>';
  return `<div class="o-overlay" data-action="mw-close"></div><div class="mw mw--dlg" style="--rc: ${color}"><section class="od2 od2--list" role="dialog" aria-label="${t==='Окно'?'Окна':'Двери и проёмы'}"><h3 class="od2__t">${t==='Окно'?'Окна':'Двери и проёмы'}</h3>${rows}<div class="od2__btns od2__btns--one">${button('Готово','close','class="od2-b ok"')}</div></section></div>`;
}
// Новое окно или дверь: сама форма как на стене и размеры как на стене; «Отмена» и «ОК».
function openingForm(r,color){
  const o=r.newOpening, isWin=o.type==='Окно';
  const fw=isWin?150:96, fh=isWin?140:200;
  const area=parse(o.width)*parse(o.height)/10000;
  return `<div class="o-overlay" data-action="mw-cancel-opening"></div><div class="mw mw--dlg" style="--rc: ${color}"><section class="od2" role="dialog" aria-label="${esc(o.type)} — размеры">
  <h3 class="od2__t">${esc(o.type)}</h3>
  <section class="measurement od2-meas" style="width: ${fw+54}px">
    <div class="dimension"><i class="dimline"></i><label class="lengthfield"><input id="mw-new-width" aria-label="Ширина, см" inputmode="numeric" value="${esc(o.width)}" placeholder="0" data-change="mw-new-width"><span>см</span></label></div>
    <div class="drawing od2-drawing" style="height: ${fh}px"><div class="heightdim"><label class="lengthfield hfield"><input id="mw-new-height" aria-label="Высота, см" inputmode="numeric" value="${esc(o.height)}" placeholder="0" data-change="mw-new-height"><span>см</span></label></div><div class="od2-fig ${isWin?'win':'door'}"></div></div>
  </section>
  <p class="od2__area">${area?`Площадь <b>${n(area)} м²</b>`:'Площадь посчитается сама'}</p>
  ${o.error?'<p class="emptywarn">Введите ширину и высоту больше нуля</p>':''}
  <div class="od2__btns">${button('Отмена','cancel-opening','class="od2-b"')}${button('ОК','confirm-opening','class="od2-b ok"')}</div>
</section></div>`;
}

export function renderMeasurement(d){
  const s=state(d);if(!s.view){const rs=estimateRooms(d);s.view=rs.length?rs[0].key:'pick';}
  if(!estimateRooms(d).some(r=>r.key===s.view)&&s.view!=='total')return measurementRoomPicker(d,s);
  const bar=measurementStrip(d,s);
  if(s.view==='total')return '<div class="mw-screen">'+bar+`<div class="mw mw--plain">${estimateRooms(d).map(r=>`<h3>${esc(r.name)}</h3>${summary(room(s,r.key))}`).join('')}</div></div>`;
  const r=room(s,s.view);if(!r.walls.length)r.walls.push({len:0,h:r.h,opens:[],svcs:[]});
  r.active=Math.min(r.active||0,r.walls.length-1);const w=r.walls[r.active];
  if(r.mwDialog==='services')return measurementServices(d,s,w);
  const er=estimateRooms(d).find(x=>x.key===s.view);const color=(er&&er.color)||'#3b82f6';
  const t=tabs(r,color);
  const body=(r.total?summary(r,t.edges):card(w,r,t.edges)).replace('<div class="wallbody',`<div style="border-radius: ${t.radius}" class="wallbody`);
  const dlg=r.mwDialog==='new-opening'?openingForm(r,color):(r.mwDialog?listDialog(r,w,color):'');
  return '<div class="mw-screen">'+bar+measurementSettings(er,r)+`<div class="mw" style="--rc: ${color}">${t.html}${body}</div></div>${dlg}`;
}

// ---------- полёт ярлыка: из кнопки в свою колонку ----------
let fly=null;
afterRender.push(()=>{
  if(!fly)return;const f=fly;fly=null;
  const src=document.querySelector(`.mw [data-fly-src="${f.kind}"]`);
  const target=f.kind==='svc'?[...document.querySelectorAll('.mw .joblist .job')].pop():[...document.querySelectorAll(`.mw .opening-shape.${f.kind} .opening-values > span`)].pop();
  if(!src||!target||!src.getBoundingClientRect)return;
  const a=src.getBoundingClientRect(),b=target.getBoundingClientRect();
  const el=document.createElement('div');el.className='fly'+(f.kind==='svc'?' fly--svc':'');el.textContent=f.text;document.body.appendChild(el);
  const x0=a.left+a.width/2-el.offsetWidth/2,y0=a.top+a.height/2-el.offsetHeight/2,x1=b.left+b.width/2-el.offsetWidth/2,y1=b.top+b.height/2-el.offsetHeight/2;
  el.style.background=getComputedStyle(src).getPropertyValue('--amber')||'';el.style.left=x0+'px';el.style.top=y0+'px';target.style.visibility='hidden';
  const dx=x1-x0,dy=y1-y0;
  const done=()=>{el.remove();target.style.visibility='';target.classList.add('land');const sh=target.closest('.opening-shape');if(sh){sh.classList.remove('hit');void sh.offsetWidth;sh.classList.add('hit');}};
  if(!el.animate||matchMedia('(prefers-reduced-motion: reduce)').matches){done();return;}
  el.animate([{transform:'translate(0,0) scale(.5)',opacity:0},{transform:'translate(0,-14px) scale(1.1)',opacity:1,offset:.18},{transform:`translate(${dx*.55}px,${dy*.55-70}px) scale(1.05)`,opacity:1,offset:.6},{transform:`translate(${dx}px,${dy}px) scale(.85)`,opacity:1}],{duration:780,easing:'cubic-bezier(.35,.6,.3,1)'}).onfinish=done;
});

// ---------- действия (логика Codex; длины в сантиметрах) ----------
actions['mw-pick']=()=>{state(oformitDraft()).view='pick';save()};
actions['mw-room']=el=>{state(oformitDraft()).view=el.dataset.key;save()};
actions['mw-wall']=el=>{const r=current();r.active=+el.dataset.i;r.total=false;r.mwDialog=null;save()};
actions['mw-delete-wall']=()=>{const r=current();r.walls.splice(r.active,1);r.active=Math.max(0,Math.min(r.active,r.walls.length-1));r.mwDialog=null;save()};
actions['mw-add-wall']=()=>{const r=current();r.walls.push({len:0,h:r.h,opens:[],svcs:r.sameSvc?[...r.walls[r.active].svcs]:[]});r.active=r.walls.length-1;r.total=false;save()};
actions['mw-total']=()=>{current().total=true;save()};
actions['mw-toggle']=el=>{const r=current(),k=el.dataset.key;r[k]=!r[k];if(k==='sameSvc'&&r[k]){r.walls[r.active].pick=[...r.walls[r.active].svcs];r.mwDialog='services';}if(k==='sameH'&&!r[k])r.walls.forEach(w=>w.h=r.h);save()};
actions['mw-services']=()=>{const r=current();r.walls[r.active].pick=[...r.walls[r.active].svcs];r.mwDialog='services';save();window.scrollTo(0,0)};
actions['mw-service']=el=>{const r=current(),w=r.walls[r.active],id=el.dataset.id;w.pick=w.pick||[...w.svcs];w.pick=w.pick.includes(id)?w.pick.filter(x=>x!==id):[...w.pick,id];save()};
actions['mw-services-done']=()=>{const r=current(),w=r.walls[r.active];const before=w.svcs.slice();w.svcs=[...(w.pick||w.svcs)];w.pick=null;if(r.sameSvc)r.walls.forEach(x=>x.svcs=[...w.svcs]);r.mwDialog=null;
  const added=w.svcs.filter(id=>!before.includes(id));if(added.length)fly={kind:'svc',text:'+ '+short(added[added.length-1])};save()};
actions['mw-close']=()=>{current().mwDialog=null;save()};
actions['mw-openings']=el=>{current().mwDialog=el.dataset.type;save()};
actions['mw-add-opening']=el=>{const r=current();r.newOpening={type:el.dataset.type,width:'',height:''};r.mwDialog='new-opening';save()};
actions['mw-delete-opening']=el=>{const r=current();r.walls[r.active].opens.splice(+el.dataset.k,1);save()};
changes['mw-length']=el=>{const r=current();r.walls[r.active].len=fromCm(el.value);S.save()};
changes['mw-height']=el=>{const r=current();r.walls[r.active].h=fromCm(el.value);S.save()};
changes['mw-roomheight']=el=>{const r=current();r.h=fromCm(el.value)||r.h;S.save()};
changes['mw-opening']=el=>{const r=current(),o=r.walls[r.active].opens[+el.dataset.k];o[el.dataset.field]=fromCm(el.value);if(o.width&&o.height)o.area=Math.round(o.width*o.height*100)/100;S.save()};
changes['mw-new-width']=el=>{current().newOpening.width=el.value;S.save()};
changes['mw-new-height']=el=>{current().newOpening.height=el.value;S.save()};
actions['mw-cancel-opening']=()=>{const r=current();r.newOpening=null;r.mwDialog=null;save()};
actions['mw-confirm-opening']=()=>{const r=current(),o=r.newOpening;
  const width=fromCm(document.getElementById('mw-new-width')?.value||o.width),height=fromCm(document.getElementById('mw-new-height')?.value||o.height);
  if(!width||!height){o.error=true;save();return;}
  const area=Math.round(width*height*100)/100;
  r.walls[r.active].opens.push({type:o.type,width,height,area});
  fly={kind:o.type==='Окно'?'win':'door',text:`${o.type} ${n(area)} м²`};
  r.newOpening=null;r.mwDialog=null;save()};
