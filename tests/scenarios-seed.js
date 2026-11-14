(async()=>{
const V='__V__';
const S=await import('./js/store.js?v='+V), B=await import('./js/board.js?v='+V), C=await import('./js/core.js?v='+V), Z=await import('./js/zakaz.js?v='+V), O=await import('./js/ocenka.js?v='+V);
const st=S.get(); st.oformit=st.oformit||{}; st.myOrders=st.myOrders||[]; st.statsLog=[];
B.sceneStart('work');
const tpl=JSON.parse(JSON.stringify(st.oformit['ord-014'])), tplM=JSON.parse(JSON.stringify(st.oformit['ord-015']));
const RN=['Гостиная','Спальня','Кухня','Детская','Коридор'], COL=['#f59e0b','#3b82f6','#ef4444','#10b981','#8b5cf6'];
const iso=n=>{const d=new Date();d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const A=C.actions, log=[], res={orders:[],unsupported:[],notes:[]};
let seq=0;
const mk=(sc,v,opt={})=>{ const no=String(3000+seq++); const nr=[1,2,4][v]; const o=JSON.parse(JSON.stringify(opt.meas?tplM:tpl));
  const phone=opt.phone||('+7 (901) '+String(100+seq).padStart(3,'0')+'-'+String(10+seq%90)+'-'+String(10+(seq*7)%90));
  Object.assign(o.cl,{name:opt.name||('Клиент '+sc+'.'+v),phone,street:'г Уфа, ул Сценарная',house:String(seq),flat:String(seq%90+1),src:['Авито','Сайт','Рекомендация','Агент'][seq%4]}); delete o.cl.snap; o.channel.source=o.cl.src;
  const rooms=[],place={},smr={};
  for(let r=0;r<nr;r++){const key='r'+no+r;
    rooms.push({key,floor:1,name:RN[(seq+r)%5],color:COL[(seq+r)%5],svcs:[{id:'prime',qty:18+r*6},{id:'paste-flizelin',qty:16+r*5}],status:'saved',panel:'',snap:{prime:18+r*6,'paste-flizelin':16+r*5}});
    place[key]=iso(opt.past?-3:(2+r)); smr[key]={sameH:true,h:2.6,sameSvc:true,dlg:null,walls:[3.4+r,4.2,3.4+r,4.2].map((len,i)=>({len,h:2.6,opens:i==1?[{name:'Окно',type:'Окно',area:2}]:[],svcs:['prime','paste-flizelin']}))}; }
  o.est={rooms,view:rooms[0].key,floor:1,confirm:null}; o.sched={...o.sched,place,mode:opt.meas?'measure':'rooms',measure:opt.meas?iso(opt.past?-2:1):''};
  if(opt.sm!==false)o.sm={view:'',rooms:smr}; else delete o.sm;
  o.disc=0; o.flow={st:opt.meas?'measure':'queue',chk:{},shift:{},done:{},day:1,rs:{},rg:{}};
  st.oformit['ord-'+no]=o; st.myOrders.push(no); S.save();
  const rec={no,sc,v,name:o.cl.name,phone,nr,exp:{st:o.flow.st,done:null,lost:null,disc:0}}; res.orders.push(rec); return {no,o,f:B.flowOf(no),rooms,rec}; };
const tot=o=>{try{return Z.smetaTotals(o)}catch(e){return {total:0,rooms:[]}}};
const est=o=>(o.est.rooms||[]).reduce((a,r)=>a+O.roomTotals(r).total,0);
const hash=async h=>{location.hash='#'+h;await wait(40)};
const ask=async(no,k)=>{A['fl-ask']({dataset:{no,k}})};
const refuse=async(x,reason='Клиент передумал')=>{ const k=1-(x.o.disc||0)/100; x.rec.exp.lost=Math.round((tot(x.o).total||est(x.o))*k); await ask(x.no,'refuse'); A['fl-refuse']({dataset:{k:reason}}); x.rec.exp.st='refused'; };
const toDone=(x,refRooms=[],disc=0)=>{ x.o.disc=disc; x.rec.exp.disc=disc; x.f.st='work'; x.rooms.forEach(r=>{x.f.rs[r.key]={st:refRooms.includes(r.key)?'refuse':'done'};x.f.done[r.key]=1}); const t=tot(x.o); x.rec.exp.done=Math.round(t.rooms.filter(q=>!refRooms.includes(q.room.key)).reduce((a,q)=>a+q.total,0)*(1-disc/100)); if(x.rec.exp.done===0){ /* все комнаты отказаны */ } A['fl-to']({dataset:{no:x.no,k:'done'}}); x.rec.exp.st='done'; if(refRooms.length===x.rooms.length){x.rec.exp.st='refused';x.rec.exp.lost=Math.round(t.total*(1-disc/100));x.rec.exp.done=null;} };
const measVisit=async(x,disc=0)=>{ await hash('bd-visit-'+x.no); x.f=B.flowOf(x.no); x.f.visit=x.f.visit||{kind:'measure',step:0,keep:{},photos:{},disc:0,today:{}}; x.f.visit.disc=disc; x.rec.exp.disc=disc; };
const dis=[0,5,10];
const SC={
 A1:async(v)=>{ const no='d'+v; st.oformit['draft-'+no]={cl:{name:'ЧЕРНОВИК-А1-'+v,phone:'+7 (999) 111-22-3'+v},est:{rooms:[{key:'dr'+v,name:'Кухня',floor:1,svcs:[{id:'prime',qty:10}]}],view:'dr'+v},sched:{}}; res.notes.push('A1 draft created ЧЕРНОВИК-А1-'+v); },
 A2:async(v)=>{ const no='d2'+v; st.oformit['draft-'+no]={cl:{name:'ЧЕРНОВИК-А2-'+v,phone:'+7 (999) 222-33-4'+v},est:{rooms:[{key:'dq'+v,name:'Зал',floor:1,svcs:[{id:'paste-flizelin',qty:20}]}],view:'dq'+v},sched:{},saved:false,dirty:true}; },
 A3:async(v)=>{ const x=mk('A3',v,{meas:true,sm:false}); },
 A4:async(v)=>{ const ph='+7 (902) 700-00-0'+v; mk('A4',v,{meas:true,sm:false,phone:ph,name:'Дубль А4.'+v}); mk('A4',v,{meas:true,sm:false,phone:ph,name:'Дубль А4.'+v}); },
 A5:async(v)=>{ const names=['','Я','А'.repeat(120)+'  😀'+v]; mk('A5',v,{meas:true,sm:false,name:names[v]||'х'}); },
 B6:async(v)=>{ mk('B6',v,{meas:true,past:true,sm:false}); },
 B7:async(v)=>{ const x=mk('B7',v,{meas:true,sm:false}); const before=x.o.sched.measure; x.o.sched.measure=iso(5+v); S.save(); x.rec.exp.measure=x.o.sched.measure; },
 B8:async(v)=>{ const x=mk('B8',v,{meas:true,sm:false}); await ask(x.no,'menu'); await ask(x.no,'call'); A['fl-call']({dataset:{k:String(2+v)}}); x.rec.exp.st='approval'; },
 B9:async(v)=>{ const x=mk('B9',v,{meas:true}); await measVisit(x); const rk=x.rooms.map(r=>r.key); if(rk.length>1)x.f.visit.keep[rk[0]]=false; A['vs-yes']({dataset:{no:x.no}}); x.rec.exp.st='queue'; },
 B10:async(v)=>{ const x=mk('B10',v,{meas:true}); await measVisit(x); A['vs-yes']({dataset:{no:x.no}}); x.rec.exp.st='queue'; },
 B11a:async(v)=>{ const x=mk('B11a',v,{meas:true}); await measVisit(x); A['vs-call']({dataset:{k:'3'}}); x.rec.exp.st='approval'; },
 B11b:async(v)=>{ const x=mk('B11b',v,{meas:true}); await measVisit(x); A['vs-call']({dataset:{k:'3'}}); await refuse(x,'Решили не делать'); },
 B11c:async(v)=>{ const x=mk('B11c',v,{meas:true}); await measVisit(x); A['vs-call']({dataset:{k:'7'}}); x.f.st='approval'; x.rec.exp.st='approval'; },
 B12:async(v)=>{ const x=mk('B12',v,{meas:true}); await measVisit(x,[3,5,7][v]); A['vs-yes']({dataset:{no:x.no}}); x.rec.exp.st='queue'; },
 B13:async(v)=>{ const x=mk('B13',v,{meas:true}); x.rec.note='sm дороже оценки'; await measVisit(x); await hash('bd-visit-'+x.no); const k=1; x.rec.exp.lost=Math.round(tot(x.o).total); A['vs-refuse']({dataset:{k:'Дороже чем ожидал'}}); x.rec.exp.st='refused'; },
 B14:async(v)=>{ const x=mk('B14',v,{meas:true}); const r=x.o.sm.rooms[x.rooms[0].key]; const bad=[0,'abc',999999][v]; r.walls[0].len=bad; r.h=[0,2.6,99][v]; x.rec.exp.st='measure'; x.rec.note='bad input '+bad; },
 C15:async(v)=>{ const x=mk('C15',v,{meas:true}); await measVisit(x); A['vs-call']({dataset:{k:String([1,3,7][v])}}); await ask(x.no,'to'); A['fl-to']({dataset:{no:x.no,k:'queue'}}); x.rec.exp.st='queue'; },
 C16:async(v)=>{ const x=mk('C16',v,{meas:true}); await measVisit(x); A['vs-call']({dataset:{k:'3'}}); await refuse(x,'Отказ по звонку'); },
 C17:async(v)=>{ const x=mk('C17',v); x.f.st='queue'; const rk=x.rooms.map(r=>r.key); x.o.sched.place[rk[0]]=iso(9); S.save(); x.rec.exp.place=iso(9); x.rec.exp.st='queue'; },
 C18:async(v)=>{ const x=mk('C18',v); await refuse(x,'Отмена клиентом'); },
 C19:async(v)=>{ const a=mk('C19',v), b=mk('C19',v); const d=iso(4); Object.keys(a.o.sched.place).forEach(k=>a.o.sched.place[k]=d); Object.keys(b.o.sched.place).forEach(k=>b.o.sched.place[k]=d); S.save(); },
 D20:async(v)=>{ const x=mk('D20',v); x.f.st='work'; x.rec.exp.st='work'; },
 D21:async(v)=>{ const x=mk('D21',v); x.f.st='work'; x.f.rs[x.rooms[0].key]={st:'done'}; x.f.done[x.rooms[0].key]=1; x.rec.exp.st='work'; },
 D22:async(v)=>{ const x=mk('D22',v); toDone(x,[x.rooms[x.rooms.length-1].key]); },
 D23:async(v)=>{ const x=mk('D23',v); x.f.st='work'; x.f.rs[x.rooms[0].key]={st:'done'}; x.f.done[x.rooms[0].key]=1; await refuse(x,'Остановил работы'); x.rec.note='частично сделано, потом отказ'; },
 D24:async(v)=>{ const x=mk('D24',v); x.f.st='work'; x.f.day=1; A['fl-shift']({dataset:{no:x.no}}); A['fl-shift']({dataset:{no:x.no}}); x.rec.exp.st='work'; },
 D25:async(v)=>{ const x=mk('D25',v); x.o.mat={view:'',scans:0,rooms:{}}; x.f.st='work'; x.rooms.forEach(r=>{x.f.rs[r.key]={st:'done'};x.f.done[r.key]=1}); x.rec.exp.st='work'; x.rec.note='без материалов'; },
 D26:async(v)=>{ const x=mk('D26',v); x.f.st='work'; x.rooms.forEach(r=>{x.f.rs[r.key]={st:'refuse'};x.f.done[r.key]=1}); toDone(x,x.rooms.map(r=>r.key)); },
 E27:async(v)=>{ const x=mk('E27',v); toDone(x,[],0); },
 E28:async(v)=>{ const x=mk('E28',v); toDone(x,x.rooms.length>1?[x.rooms[0].key]:[],[3,5,10][v]); },
 E29:async(v)=>{ const x=mk('E29',v); toDone(x,[],0); x.o.fin={pays:[{kind:'Аванс',amount:5000,date:iso(-2),method:'Перевод'},{kind:'Остаток',amount:Math.max(0,x.rec.exp.done-5000),date:iso(0),method:'Наличные'}],exps:[]}; x.rec.exp.paid=x.o.fin.pays.reduce((a,p)=>a+p.amount,0); },
 E30:async(v)=>{ const x=mk('E30',v); toDone(x,[],0); x.o.fin={pays:[{kind:'Аванс',amount:x.rec.exp.done,date:iso(0),method:'Перевод'}],exps:[{kind:'Материал',amount:3000+v*1000,date:iso(-1)},{kind:'Транспорт',amount:800,date:iso(-1)}]}; },
 E31:async(v)=>{ const ph='+7 (903) 800-00-0'+v; const a=mk('E31',v,{phone:ph,name:'Повторный Е31.'+v}); toDone(a); const b=mk('E31',v,{phone:ph,name:'Повторный Е31.'+v}); toDone(b); },
 F32:async(v)=>{ const ph='+7 (904) 900-00-0'+v; const a=mk('F32',v,{meas:true,phone:ph,name:'Вернулся F32.'+v}); await measVisit(a); await hash('bd-visit-'+a.no); a.rec.exp.lost=Math.round(tot(a.o).total); A['vs-refuse']({dataset:{k:'Передумал'}}); a.rec.exp.st='refused'; const b=mk('F32',v,{phone:ph,name:'Вернулся F32.'+v}); toDone(b); },
};
for(const id of Object.keys(SC)) for(let v=0;v<3;v++){ try{ await SC[id](v); }catch(e){ res.notes.push('SCENARIO-ERR '+id+'.'+v+': '+e.message); } S.save(); }
for(const r of res.orders){ r.st=B.flowOf(r.no).st; const d=st.oformit['ord-'+r.no]; r.total=Math.round(tot(d).total); r.disc=d.disc||0; r.measure=d.sched.measure; r.place=Object.values(d.sched.place)[0]; }
res.log=S.get().statsLog||[];
return res;})()
