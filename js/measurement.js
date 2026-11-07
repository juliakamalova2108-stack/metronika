// «Оформить заказ» → вкладка «Замер» (в открытом заказе — «Смета»).
// Графитовая пластина с закладками стен, плашки площадей, стена-миллиметровка, кнопки под своими колонками,
// размеры в сантиметрах, полёт ярлыка. Оформление — css/measurement.css; цвет комнаты передаётся как --rc.
import {actions,changes,rerender,afterRender} from './core.js?v=232';
import * as S from './store.js?v=232';
import {oformitDraft} from './oformit.js?v=232';
import {estimateRooms,svcInfo,SVC_LIST,SHORT_NAMES,measurementRoomPicker,measurementServices,measurementStrip,measurementSettings,measurementStart,measurementClosePick} from './ocenka.js?v=232';
import {esc} from './ui.js?v=232';

// ---------- числа ----------
const n=x=>Number(x||0).toLocaleString('ru-RU',{minimumFractionDigits:2,maximumFractionDigits:2});
const rub=x=>Math.round(x).toLocaleString('ru-RU')+' ₽';
const parse=x=>Math.max(0,parseFloat(String(x).replace(',','.'))||0);
const cm=m=>m?String(Math.round(m*100)):'';          // метры → сантиметры для поля
const fromCm=v=>parse(v)/100;                        // сантиметры из поля → метры

// ---------- данные ----------
const state=d=>d.sm||(d.sm={view:'',rooms:{}});   // первый вход: открыть первую комнату, если она есть
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
const H=44, SL=26, SEL_W=104, SUM_W=76;
// Закладки на графитовой пластине — общие для «Замера» (стены) и «Материала» (материалы комнаты).
// o: n — сколько закладок, sel — выбранная (−1 — открыт «Итог»), total — открыт «Итог», label(i) — подпись выбранной,
// act / addAct / totalAct — действия закладки, «+» и «Итог», name — подпись ряда для чтения с экрана.
export function sheetTabs(o,color){
  const n0=o.n, sel=o.total?-1:o.sel;
  const TW=72, PW=2*(72-SL+2)+SL-2;               // невыбранная закладка; «+» шириной как две свёрнутые
  const w=i=>i===sel?SEL_W:TW;
  const xs=[];let x=0;for(let i=0;i<n0;i++){xs.push(x);x+=w(i)-SL+2;}
  const plusX=x, innerW=plusX+PW;
  const flag=(x0,ww)=>`M${x0+.5} ${H} L${x0+.5} 4.5 Q${x0+.5} .5 ${x0+4.5} .5 L${x0+ww-SL} .5 L${x0+ww-.5} ${H} Z`;
  const order=[...Array(n0).keys()].filter(i=>i!==sel).sort((a,b)=>Math.abs(b-(sel<0?n0:sel))-Math.abs(a-(sel<0?n0:sel)));
  const back=`<path class="gt-back" d="${flag(plusX,PW)}"/>`+order.map(i=>`<path class="gt-back" d="${flag(xs[i],w(i))}"/>`).join('');
  const lite=`<defs><linearGradient id="gtLite" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${color}"/><stop offset=".45" stop-color="${light(color)}"/><stop offset="1" stop-color="${color}" stop-opacity=".25"/></linearGradient></defs>`;
  const base=sel<0?`<path class="gt-base" d="M0 ${H-.5} L${innerW} ${H-.5}"/>`:`<path class="gt-base" d="M0 ${H-.5} L${xs[sel]} ${H-.5} M${xs[sel]+SEL_W} ${H-.5} L${innerW} ${H-.5}"/>`;
  const front=sel<0?'':`<path class="gt-sel" d="M${xs[sel]} ${H+1} L${xs[sel]} 4 Q${xs[sel]} 0 ${xs[sel]+4} 0 L${xs[sel]+SEL_W-SL} 0 L${xs[sel]+SEL_W} ${H+1} Z"/>`+
    `<path class="gt-hl" d="M${xs[sel]+.8} ${H} L${xs[sel]+.8} 4.5 Q${xs[sel]+.8} .8 ${xs[sel]+4.5} .8 L${xs[sel]+SEL_W-SL} .8 L${xs[sel]+SEL_W} ${H}" fill="none" stroke="url(#gtLite)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
  // Кнопка = видимая часть закладки, цифра по её центру.
  const btn=i=>{let l,ww;
    if(i===sel){l=xs[i];ww=SEL_W-SL*.5;}
    else if(sel<0||i<sel){l=xs[i];ww=(i+1<n0?xs[i+1]:xs[i]+TW-SL*.5)-xs[i];}
    else {l=xs[i]+SL*.5;ww=TW-SL;}
    return `<button type="button" class="gt-b${i===sel?' on':''}" data-action="${o.act}" data-i="${i}" style="left: ${Math.round(l)}px; width: ${Math.round(ww)}px">${i===sel?o.label(i):i+1}${o.mark&&o.mark(i)?'<i class="gt-dot" aria-label="без опыта"></i>':''}</button>`;};
  const plusL=n0?plusX+SL*.5:0, plusBW=n0?PW-SL:PW-SL*.5;
  const left=`<div class="gt-scroll"><div class="gt-inner" style="width: ${innerW}px"><svg class="gt-svg" width="${innerW}" height="${H+1}" viewBox="0 0 ${innerW} ${H+1}" aria-hidden="true">${lite}${back}${base}${front}</svg>`+
    [...Array(n0).keys()].map(btn).join('')+
    `<button type="button" class="gt-b add" data-action="${o.addAct}" aria-label="${o.addLabel}" style="left: ${Math.round(plusL)}px; width: ${Math.round(plusBW)}px">+</button></div></div>`;
  const tot=!!o.total;
  const SW=o.square?SUM_W+10:SUM_W;
  const sumD=`M${SL} ${H} L1.5 2 Q.8 .5 3 .5 L${SW-6.5} .5 Q${SW-.5} .5 ${SW-.5} 6.5 L${SW-.5} ${H}`;
  // o.square: правая закладка прямоугольная, пока до неё не дошёл «+»; дошёл — становится скошенной (класс is-slant, см. ниже).
  const sqD=`M${SL+.5} ${H} L${SL+.5} 4.5 Q${SL+.5} .5 ${SL+4.5} .5 L${SW-6.5} .5 Q${SW-.5} .5 ${SW-.5} 6.5 L${SW-.5} ${H}`;
  const selD={[sumD]:`M${SL} ${H+1} L1 1.5 Q.3 0 2.5 0 L${SW-6} 0 Q${SW} 0 ${SW} 6 L${SW} ${H+1} Z`,
    [sqD]:`M${SL} ${H+1} L${SL} 4 Q${SL} 0 ${SL+4} 0 L${SW-6} 0 Q${SW} 0 ${SW} 6 L${SW} ${H+1} Z`};
  const shape=(d,cls)=>tot
    ?`<g class="${cls}"><path class="gt-sel" d="${selD[d]}"/><path class="gt-hl" d="${d}" fill="none" stroke="url(#gtLite2)" stroke-width="1.6" stroke-linejoin="round"/></g>`
    :`<g class="${cls}"><path class="gt-back" d="${d} Z"/></g>`;
  const paths=o.square?shape(sumD,'gt-slant')+shape(sqD,'gt-sq'):shape(sumD,'');
  const right=`<div class="gt-right${tot?' on':''}${o.square?' gt-right--sq':''}" style="width: ${SW}px"><svg class="gt-svg" width="${SW}" height="${H+1}" viewBox="0 0 ${SW} ${H+1}" aria-hidden="true">${tot?lite.replace('gtLite','gtLite2'):''}${paths}`+
    `</svg><button type="button" class="gt-b${tot?' on':''}" data-action="${o.totalAct}" style="left: ${o.square?SL:6}px; width: ${SW-(o.square?SL:6)}px">${o.totalLabel||'Итог'}${o.totalBlink?'<i class="gt-dot gt-dot--blink" aria-label="эти обои вы уже клеили"></i>':o.totalMark?'<i class="gt-dot" aria-label="есть материалы без опыта"></i>':''}</button></div>`;
  return {html:`<i class="gt-sheet" aria-hidden="true"></i><nav class="gt-tabs" aria-label="${o.name}">${left}${right}</nav>`, radius:'0 0 24px 24px', edges:''};
}
function tabs(r,color){
  return sheetTabs({n:r.walls.length,sel:r.active,total:r.total,label:i=>'Стена '+(i+1),act:'mw-wall',addAct:'mw-add-wall',addLabel:'Добавить стену',totalAct:'mw-total',name:'Стены'},color);
}

// Прокрутка закладок: сохраняем положение между перерисовками; новую выбранную закладку показываем целиком.
let tabScroll=0, tabSelKey='';
afterRender.push(()=>{
  const sc=document.querySelector('.mw .gt-scroll');if(!sc)return;
  const on=sc.querySelector('.gt-b.on');const key=(on&&on.dataset.i)||'total';
  sc.scrollLeft=tabScroll;
  if(on&&key!==tabSelKey){const vis=sc.clientWidth-26;                 // правые 25px закрыты «Итогом»
    const last=!on.parentElement.querySelector('.gt-b[data-i="'+(+key+1)+'"]');
    if(last)sc.scrollLeft=sc.scrollWidth;                                 // последняя стена — видно её и «+»
    else{const l=on.offsetLeft,r2=l+on.offsetWidth+30;if(l<sc.scrollLeft+8||r2>sc.scrollLeft+vis)sc.scrollLeft=Math.max(0,l-(vis-on.offsetWidth)/2);}}
  tabSelKey=key;tabScroll=sc.scrollLeft;
  // Квадратная правая закладка скашивается, когда ряд закладок с «+» доходит до неё.
  const rt=sc.parentElement.querySelector('.gt-right--sq');
  if(rt){const fit=()=>{const inner=sc.querySelector('.gt-inner');rt.classList.toggle('is-slant',inner.offsetWidth>sc.clientWidth-26);};fit();
    if(!window.__gtFit){window.__gtFit=1;addEventListener('resize',()=>{const r=document.querySelector('.mw .gt-right--sq'),c=document.querySelector('.mw .gt-scroll');if(r&&c)r.classList.toggle('is-slant',c.querySelector('.gt-inner').offsetWidth>c.clientWidth-26);});}}
  sc.addEventListener('scroll',()=>{tabScroll=sc.scrollLeft;},{passive:true});
});

// ---------- итоги: стена → комната → весь замер ----------
// Вид — как «Итог» во вкладке «Оценка»: свёрнутые плашки с цветной полосой (нажатие раскрывает строки),
// «Итого по видам работ» строками, внизу общий итог.
const openSum=new Set();
const CHEV='<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 5.5L8 10.5L13 5.5" stroke="#EDF0E7" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const fmt=x=>Math.round(x).toLocaleString('ru-RU');
const m2=x=>n(x).replace(/,00$/,'');
const minus=x=>x>0?'−'+n(x):n(0);
const plural=(k,a,b,c)=>{const m=k%10,h=k%100;return m===1&&h!==11?a:m>=2&&m<=4&&(h<12||h>14)?b:c;};
const workHead='<div class="o-tline o-tline--h"><span>Работа</span><span>м²</span><span>₽/м²</span><span>Сумма</span></div>';
const workLine=l=>`<div class="o-tline"><span class="o-tline__n">${esc(short(l.id))}</span><span>${m2(l.area)}</span><span>${fmt(svcInfo(l.id).price)}</span><b>${fmt(l.sum)} ₽</b></div>`;
// итог одной стены
function wallTotals(w,r){const g=gross(w,r),o=holes(w),a=net(w,r);
  const lines=w.svcs.map(id=>({id,area:a,sum:Math.round(a*svcInfo(id).price)}));
  return {g,o,a,lines,sum:lines.reduce((x,l)=>x+l.sum,0)};}
// итог комнаты = сумма итогов её стен
function roomTotals(r){const ws=r.walls.map(w=>wallTotals(w,r));const by=new Map();
  ws.forEach(t=>t.lines.forEach(l=>{const o=by.get(l.id)||{id:l.id,area:0,sum:0};o.area+=l.area;o.sum+=l.sum;by.set(l.id,o);}));
  const sumOf=k=>ws.reduce((x,t)=>x+t[k],0);
  return {ws,g:sumOf('g'),o:sumOf('o'),a:sumOf('a'),sum:sumOf('sum'),lines:[...by.values()]};}
const areas=(t)=>`<div class="summary-areas"><span>S общая<b>${n(t.g)} м²</b></span><span>S проёмов<b>${minus(t.o)} м²</b></span><span>S рабочая<b>${n(t.a)} м²</b></span></div>`;
const fold=(key,color,title,sub,sum,sumSub,body)=>{const on=openSum.has(key);
  return `<section class="o-sroom${on?' is-open':''}" style="--rc:${color}"><button type="button" class="o-sroom__head" data-action="mw-sum-toggle" data-key="${esc(key)}" aria-expanded="${on}">
    <span class="o-sroom__name"><b>${title}</b><small>${sub}</small></span><span class="o-sroom__sum"><b>${fmt(sum)} ₽</b><small>${sumSub}</small></span><span class="o-sroom__chev">${CHEV}</span></button>
    <div class="o-sroom__list">${body}</div></section>`;};
const byWork=(lines,title)=>`<section class="f-plate o-bywork"><p class="o-sec o-sec--in">${title}</p>${lines.length?workHead+lines.map(workLine).join(''):'<p class="mw-none">Работы пока не добавлены</p>'}</section>`;
const grand=(title,sum,sub)=>`<section class="f-plate o-grand"><p class="o-grand__t">${title}</p><b class="o-grand__sum">${fmt(sum)} ₽</b><p class="o-grand__x">${sub}</p></section>`;

// итог комнаты (закладка «Итог» у стен)
function summary(r,color,key){
  const t=roomTotals(r);
  const walls=t.ws.map((w,i)=>{const wl=r.walls[i];
    const opens=wl.opens.map(o=>`<div class="o-tline"><span class="o-tline__n">${esc(o.type)}${o.width&&o.height?` <small>${cm(o.width)}×${cm(o.height)}</small>`:''}</span><span>−${m2(o.area)}</span><span></span><span></span></div>`).join('');
    return fold(key+':'+i,color,'Стена '+(i+1),`${cm(wl.len)||'—'} × ${cm(r.sameH?r.h:wl.h)} см · ${n(w.a)} м²`,w.sum,
      `${w.lines.length} ${plural(w.lines.length,'работа','работы','работ')}`,
      (w.lines.length?workHead+w.lines.map(workLine).join(''):'<p class="mw-none">Работ нет</p>')+opens);}).join('');
  return `<div class="wallbody room-summary">${areas(t)}<div class="o-stack"><p class="o-sec">Стены</p>${walls}
    ${byWork(t.lines,'Работы по комнате')}${grand('Итого по комнате',t.sum,`${r.walls.length} ${plural(r.walls.length,'стена','стены','стен')} · ${n(t.a)} м²`)}</div></div>`;
}
// итог всего замера (плитка «Итог» сверху): комнаты = итоги комнат
function allSummary(d,s){
  const rs=estimateRooms(d).map(er=>({er,r:room(s,er.key)})).map(x=>({...x,t:roomTotals(x.r)}));
  const by=new Map();rs.forEach(x=>x.t.lines.forEach(l=>{const o=by.get(l.id)||{id:l.id,area:0,sum:0};o.area+=l.area;o.sum+=l.sum;by.set(l.id,o);}));
  const tot={g:0,o:0,a:0,sum:0};rs.forEach(x=>{tot.g+=x.t.g;tot.o+=x.t.o;tot.a+=x.t.a;tot.sum+=x.t.sum;});
  const wallHead='<div class="o-tline o-tline--h"><span>Стена</span><span>м²</span><span></span><span>Сумма</span></div>';
  const rooms=rs.map(({er,r,t})=>fold('room:'+er.key,er.color||'#7c8f8a',esc(er.name),
    `${r.walls.length} ${plural(r.walls.length,'стена','стены','стен')} · ${n(t.a)} м²`,t.sum,`${t.lines.length} ${plural(t.lines.length,'работа','работы','работ')}`,
    r.walls.length?wallHead+t.ws.map((w,i)=>`<div class="o-tline"><span class="o-tline__n">Стена ${i+1}</span><span>${m2(w.a)}</span><span></span><b>${fmt(w.sum)} ₽</b></div>`).join(''):'<p class="mw-none">Стены ещё не замерены</p>')).join('');
  return `<div class="wallbody room-summary">${areas(tot)}<div class="o-stack"><p class="o-sec">Комнаты</p>${rooms}
    ${byWork([...by.values()],'Итого по видам работ')}${grand('Итого по замеру',tot.sum,`${rs.length} ${plural(rs.length,'комната','комнаты','комнат')} · ${n(tot.a)} м²`)}</div></div>`;
}
actions['mw-sum-toggle']=el=>{const k=el.dataset.key;if(openSum.has(k))openSum.delete(k);else openSum.add(k);rerender();};

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
  const start=measurementStart(d);if(start)return start;
  if(!estimateRooms(d).some(r=>r.key===s.view)&&s.view!=='total')return measurementRoomPicker(d,s);
  const bar=measurementStrip(d,s);
  if(s.view==='total')return '<div class="mw-screen">'+bar+`<div class="mw mw--plain">${allSummary(d,s)}</div></div>`;
  const r=room(s,s.view);if(!r.walls.length)r.walls.push({len:0,h:r.h,opens:[],svcs:[]});
  r.active=Math.min(r.active||0,r.walls.length-1);const w=r.walls[r.active];
  if(r.mwDialog==='services')return measurementServices(d,s,w);
  const er=estimateRooms(d).find(x=>x.key===s.view);const color=(er&&er.color)||'#3b82f6';
  const t=tabs(r,color);
  const body=(r.total?summary(r,color,s.view):card(w,r,t.edges)).replace('<div class="wallbody',`<div style="border-radius: ${t.radius}" class="wallbody`);
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
  el.style.background=getComputedStyle(src).getPropertyValue('--rc-light')||'';el.style.left=x0+'px';el.style.top=y0+'px';target.style.visibility='hidden';
  const dx=x1-x0,dy=y1-y0;
  const done=()=>{el.remove();target.style.visibility='';target.classList.add('land');const sh=target.closest('.opening-shape');if(sh){sh.classList.remove('hit');void sh.offsetWidth;sh.classList.add('hit');}};
  if(!el.animate||matchMedia('(prefers-reduced-motion: reduce)').matches){done();return;}
  el.animate([{transform:'translate(0,0) scale(.5)',opacity:0},{transform:'translate(0,-14px) scale(1.1)',opacity:1,offset:.18},{transform:`translate(${dx*.55}px,${dy*.55-70}px) scale(1.05)`,opacity:1,offset:.6},{transform:`translate(${dx}px,${dy}px) scale(.85)`,opacity:1}],{duration:780,easing:'cubic-bezier(.35,.6,.3,1)'}).onfinish=done;
});

// ---------- действия (длины в сантиметрах) ----------
// «+» открывает список комнат, «×» закрывает и возвращает туда, где были (как в «Оценке»).
actions['mw-pick']=()=>{const d=oformitDraft(),s=state(d),rs=estimateRooms(d);
  if(s.view==='pick'||!rs.some(r=>r.key===s.view)&&s.view!=='total'){
    if(!rs.length){measurementClosePick(d);save();return;}
    s.view=s.back&&(s.back==='total'||rs.some(r=>r.key===s.back))?s.back:rs[rs.length-1].key;}
  else{s.back=s.view;s.view='pick';}
  save();window.scrollTo(0,0)};
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

// Поля сантиметров растут под ввод: базовая ширина — 3 цифры, длиннее число (например 15000) — поле шире.
const FIT_SEL='.mw .lengthfield input, .mw-screen .o-qty input';
function fitInput(inp){const n=Math.max(3,String(inp.value||inp.placeholder||'').length);inp.style.width=`calc(${n}ch + 2px)`;}
afterRender.push(()=>document.querySelectorAll(FIT_SEL).forEach(fitInput));
document.addEventListener('input',ev=>{const t=ev.target;if(t&&t.matches&&t.matches(FIT_SEL))fitInput(t);},true);
