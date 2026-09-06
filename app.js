
const SF_DIAG={backend:null,skinport:null,steam:null,lastError:null,items:0,clean:0,lastUpdate:null,fallback:false};

async function sfFetchJson(url, opts={}){
  const r=await fetch(url,opts);
  const text=await r.text();
  let data=null;
  try{data=JSON.parse(text)}catch(e){}
  if(!r.ok) throw new Error((data&&data.error)||`${r.status} ${r.statusText}`);
  return {data,headers:r.headers,status:r.status};
}

async function checkSystemStatus(){
  try{
    const {data}=await sfFetchJson('/api/status');
    SF_DIAG.backend=true;
    SF_DIAG.skinport=data?.skinport?.ok;
    SF_DIAG.steam=data?.steam?.ok;
    renderStatusPage(data);
  }catch(e){
    SF_DIAG.backend=false; SF_DIAG.lastError=e.message; renderStatusPage(null,e);
  }
}

function diagnosticBadge(ok, unknownText='Не проверено'){
  if(ok===true) return '<span class="diag ok">● OK</span>';
  if(ok===false) return '<span class="diag bad">● Ошибка</span>';
  return `<span class="diag warn">● ${unknownText}</span>`;
}

function renderStatusPage(data,err){
  const root=document.getElementById('statusRoot'); if(!root)return;
  const sp=data?.skinport||{};
  const st=data?.steam||{};
  const cache=data?.cache||{};
  root.innerHTML=`
    <div class="status-grid">
      <div class="status-card"><span>Backend</span><strong>${diagnosticBadge(!!data)}</strong><small>${data?`Uptime ${Math.floor((data.uptime_sec||0)/60)} мин`:(err?.message||'Нет ответа')}</small></div>
      <div class="status-card"><span>Skinport API</span><strong>${diagnosticBadge(sp.ok)}</strong><small>${sp.item_count?`${sp.item_count.toLocaleString('ru-RU')} предметов`:(sp.last_error||'Ожидание проверки')}</small></div>
      <div class="status-card"><span>Steam Market</span><strong>${diagnosticBadge(st.ok)}</strong><small>${st.last_error||st.last_success||'Проверяется при запросе цены'}</small></div>
      <div class="status-card"><span>Fallback cache</span><strong>${diagnosticBadge(!!cache.has_last_good_items,'Пусто')}</strong><small>${cache.last_good_item_count?`${cache.last_good_item_count.toLocaleString('ru-RU')} предметов`:'Нет сохранённого snapshot'}</small></div>
    </div>
    <div class="panel status-details">
      <h3>Диагностика</h3>
      <div><b>Сервис:</b> ${data?.service||'—'}</div>
      <div><b>Node:</b> ${data?.node||'—'}</div>
      <div><b>Skinport последний успех:</b> ${sp.last_success||'—'}</div>
      <div><b>Skinport последняя ошибка:</b> ${sp.last_error||'—'}</div>
      <div><b>Последний snapshot:</b> ${cache.last_good_items_at||'—'}</div>
    </div>`;
}

function cacheLiveItems(items){
  try{
    localStorage.setItem('skinforge_last_live_items',JSON.stringify(items));
    localStorage.setItem('skinforge_last_live_at',new Date().toISOString());
  }catch(e){}
}
function getCachedLiveItems(){
  try{
    const x=JSON.parse(localStorage.getItem('skinforge_last_live_items')||'null');
    return Array.isArray(x)?x:null;
  }catch(e){return null}
}

function periodHistoryValue(h,p){
  if(!h)return null;
  const map={24:'last_24_hours',7:'last_7_days',30:'last_30_days',90:'last_90_days'};
  return h[map[p]]||null;
}

function renderHistorySummary(history){
  const root=document.getElementById('historySummary'); if(!root)return;
  const periods=[24,7,30,90];
  root.innerHTML=periods.map(p=>{
    const h=periodHistoryValue(history,p);
    if(!h)return `<div class="stat-box"><span>${p===24?'24ч':p+'д'}</span><strong>—</strong><small>Нет данных</small></div>`;
    const avg=Number(h.avg||h.mean||h.average||0);
    const min=Number(h.min||h.minimum||0);
    const max=Number(h.max||h.maximum||0);
    return `<div class="stat-box"><span>${p===24?'24ч':p+'д'}</span><strong>${avg?money(avg):'—'}</strong><small>${min?money(min):'—'} — ${max?money(max):'—'}</small></div>`;
  }).join('');
}

function heroGo(){const q=(document.getElementById('heroSearch')?.value||'').trim();location.href='catalog.html'+(q?'?q='+encodeURIComponent(q):'');}
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const money=n=>n==null?'—':'$'+Number(n).toFixed(2);
const favs=()=>JSON.parse(localStorage.getItem('skinforge_favs')||'[]');
const setFavs=v=>localStorage.setItem('skinforge_favs',JSON.stringify(v));
function toggleFav(id){let f=favs();f=f.includes(id)?f.filter(x=>x!==id):[...f,id];setFavs(f);renderFavStates()}
function renderFavStates(){$$('.fav').forEach(b=>b.classList.toggle('active',favs().includes(b.dataset.id)))}

function portfolio(){return JSON.parse(localStorage.getItem('skinforge_portfolio')||'[]')}
function setPortfolio(v){localStorage.setItem('skinforge_portfolio',JSON.stringify(v))}
function portfolioEntry(id){return portfolio().find(x=>x.id===id)}
function addPortfolio(id, qty=1, buyPrice=null){
  let p=portfolio(), s=SKINS.find(x=>x.id===id); if(!s)return;
  let e=p.find(x=>x.id===id);
  qty=Math.max(0.01,Number(qty)||1);
  buyPrice=Number(buyPrice);
  if(!Number.isFinite(buyPrice)||buyPrice<=0) buyPrice=Number(s.price)||0;
  if(e){
    const oldQty=Number(e.qty)||0, newQty=oldQty+qty;
    e.buyPrice=((Number(e.buyPrice)||0)*oldQty+buyPrice*qty)/newQty;
    e.qty=newQty;
  }else{
    p.push({id,qty,buyPrice,addedAt:Date.now()});
  }
  setPortfolio(p);
  document.dispatchEvent(new Event('skinforge-portfolio-change'));toast('Портфель обновлён','Данные сохранены в этом браузере');
}
function removePortfolio(id){
  setPortfolio(portfolio().filter(x=>x.id!==id));
  document.dispatchEvent(new Event('skinforge-portfolio-change'));
}
function clearPortfolio(){
  setPortfolio([]);
  document.dispatchEvent(new Event('skinforge-portfolio-change'));
}


function trendFromHistory(h){
  if(!h) return {trend24:0,trend7:0};
  const avg24=h.last_24_hours?.avg, avg7=h.last_7_days?.avg, avg30=h.last_30_days?.avg;
  const pct=(a,b)=>a&&b?((a-b)/b*100):0;
  return {trend24:+pct(avg24,avg7).toFixed(1), trend7:+pct(avg7,avg30).toFixed(1)};
}

function dealScore(s,feePct=8){
  const price=Number(s.price||0), suggested=Number(s.suggested||0);
  // Mean/median can be distorted by rare floats and stickered listings. Skinport's
  // suggested price is the safer like-for-like reference for an uninspected item.
  const reference=Number.isFinite(suggested)&&suggested>0?suggested:price;
  const discount=reference>0&&price>0?Math.max(-30,Math.min(40,(reference-price)/reference*100)):0;
  const liquidity=Math.min(25,Math.log10(Math.max(1,s.quantity||0)+1)*9);
  const swing=Math.min(25,Math.abs(Number(s.trend7)||0));
  const dataBonus=s.history?10:4;
  const stability=Math.max(0,20-swing*1.5);
  const gross=reference*(1-feePct/100)-price;
  // Even without history, reserve at least 5%: the item cannot be immediately
  // transferred again and its exit price is unknown for the lock period.
  const lockRiskPct=Math.min(25,Math.max(5,swing));
  const lockReserve=price*lockRiskPct/100;
  const afterLock=gross-lockReserve;
  const valueBonus=Math.min(10,Math.log10(1+Math.max(0,afterLock))*6);
  const score=Math.round(Math.max(0,Math.min(100,discount*.8+liquidity+dataBonus+stability+valueBonus)));
  const risk=swing>=10||(s.quantity||0)<10?'Высокий':swing>=5||(s.quantity||0)<40||!s.history?'Средний':'Низкий';
  const verdict=score>=72&&afterLock>0?'Выгодно':score>=50&&afterLock>0?'Наблюдать':'Рискованно';
  return {score,reference,discount,liquidity:Math.round(liquidity),swing,risk,gross,lockReserve,afterLock,verdict,feePct};
}
function scoreClass(m){return m.score>=72?'score-good':m.score>=50?'score-watch':'score-risk'}
function scoreBadge(s,feePct=8){const m=dealScore(s,feePct);return `<span class="deal-score ${scoreClass(m)}" title="Учитывает цену, ликвидность, движение рынка, комиссию ${m.feePct}% и риск 7-дневной блокировки">SF ${m.score}/100 · ${m.verdict}</span>`}



function skinportToSkin(i){
  const marketHash=String(i?.market_hash_name||'').trim();
  const marketType=classifyMarketItemName(marketHash);
  const stattrak=/^StatTrak™\s*/i.test(marketHash);
  const cleaned=marketHash.replace(/^StatTrak™\s*/i,'').trim();

  const condMatch=cleaned.match(/\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)$/i);
  const condition=condMatch?condMatch[1]:'';
  const withoutCond=cleaned.replace(/\s*\((Factory New|Minimal Wear|Field-Tested|Well-Worn|Battle-Scarred)\)$/i,'').trim();

  const parts=withoutCond.split('|').map(x=>x.trim());
  const weapon=parts[0]||'';
  const finish=parts.slice(1).join(' | ')||'';

  const min=Number(i?.min_price);
  const mean=Number(i?.mean_price);
  const median=Number(i?.median_price);
  const suggested=Number(i?.suggested_price);
  const price=Number.isFinite(min)&&min>0?min:(Number.isFinite(median)&&median>0?median:(Number.isFinite(mean)&&mean>0?mean:(Number.isFinite(suggested)&&suggested>0?suggested:0)));

  const refCandidates=[mean,median,suggested].filter(v=>Number.isFinite(v)&&v>0);
  const reference=refCandidates.length?refCandidates[0]:0;
  const dealPct=saneDealPercent(price,reference);

  const category =
    /knife|karambit|bayonet|daggers|kukri|talon|ursus|stiletto|navaja|nomad|paracord|survival|classic knife|skeleton knife/i.test(weapon) ? 'knife' :
    /awp|ssg 08|scar-20|g3sg1/i.test(weapon) ? 'sniper' :
    /ak-47|m4a1-s|m4a4|galil ar|famas|aug|sg 553/i.test(weapon) ? 'rifle' :
    /glock-18|usp-s|desert eagle|p250|five-seven|tec-9|cz75-auto|dual berettas|r8 revolver/i.test(weapon) ? 'pistol' :
    /mp9|mac-10|mp7|mp5-sd|ump-45|p90|pp-bizon/i.test(weapon) ? 'smg' :
    /nova|xm1014|mag-7|sawed-off|m249|negev/i.test(weapon) ? 'heavy' :
    'other';

  const imgWeapon=encodeURIComponent(weapon).replace(/%20/g,'%20');
  const imgFinish=encodeURIComponent(finish).replace(/%20/g,'%20');
  const img=weapon&&finish ? `https://specs.gg/assets/img/cs2_skins/${imgWeapon}/${imgFinish}.png` : '';

  const id=encodeURIComponent(marketHash).replace(/%/g,'').slice(0,120);

  return {
    id, marketHash, name:withoutCond||marketHash, weapon, finish, condition,
    stattrak, category, marketType, img, price,
    mean:Number.isFinite(mean)?mean:null,
    median:Number.isFinite(median)?median:null,
    suggested:Number.isFinite(suggested)?suggested:null,
    quantity:Number(i?.quantity)||0,
    itemPage:i?.item_page||'',
    marketPage:i?.market_page||'',
    dealPct,
    trend7:0,
    live:true
  };
}


async function loadLiveData(){
  try{
    const itemsRes=await fetch('/api/items',{cache:'no-store'});
    if(!itemsRes.ok) throw new Error('Items API '+itemsRes.status);
    const items=await itemsRes.json();
    if(!Array.isArray(items)) throw new Error('Skinport returned non-array');

    const live=(Array.isArray(items)?items:[]).map(i=>{
      try{return skinportToSkin(i)}catch(e){console.warn('SkinForge: bad Skinport item skipped',i?.market_hash_name,e);return null}
    }).filter(Boolean);
    window.LIVE_SKINS=live;
    window.CLEAN_SKINS=live.filter(isUsableLiveSkin);
    SF_DIAG.items=live.length;SF_DIAG.clean=window.CLEAN_SKINS.length;SF_DIAG.lastUpdate=new Date().toISOString();
    window.LIVE_MATCHED=live.length;
    window.LIVE_READY=live.length>0;
    window.LIVE_UPDATED_AT=Date.now();

    try{
      const hr=await fetch('/api/history',{cache:'no-store'});
      if(hr.ok){
        const hist=await hr.json();
        if(Array.isArray(hist)){
          const norm=v=>String(v||'').replace(/\s+/g,' ').trim().toLowerCase();
          const hm=new Map(hist.map(x=>[norm(x.market_hash_name),x]));
          live.forEach(s=>{
            const h=hm.get(norm(s.hash));
            if(h){s.history=h;Object.assign(s,trendFromHistory(h));}
          });
        }
      }
    }catch(e){console.warn('History unavailable',e)}

    checkPriceAlerts();
    console.log(`SkinForge v13: Skinport LIVE ${live.length} items`);
    markSkinportOnline();document.dispatchEvent(new Event('skinforge-live-ready'));
    document.dispatchEvent(new Event('skinforge-history-ready'));
  }catch(e){
    console.warn('Skinport items unavailable',e);
    window.LIVE_SKINS=[];
    window.LIVE_READY=false;
    window.LIVE_MATCHED=0;
    document.dispatchEvent(new Event('skinforge-live-ready'));
  }
}


function classifyMarketItemName(name=''){
  const n=String(name).toLowerCase();
  if(/sticker\s*\|/.test(n)) return 'sticker';
  if(/case$|case\s*\|/.test(n) || /weapon case/.test(n)) return 'case';
  if(/capsule|package|souvenir package/.test(n)) return 'container';
  if(/patch\s*\|/.test(n)) return 'patch';
  if(/charm\s*\|/.test(n)) return 'charm';
  if(/music kit\s*\|/.test(n)) return 'music';
  if(/graffiti\s*\|/.test(n)) return 'graffiti';
  if(/agent\s*\|/.test(n) || /'the doctor'|'sir bloody'|'bloody darryl'/.test(n)) return 'agent';
  if(name.includes('|')) return 'skin';
  return 'other';
}

function saneDealPercent(price, reference){
  const p=Number(price), r=Number(reference);
  if(!Number.isFinite(p) || !Number.isFinite(r) || p<=0 || r<=0) return 0;
  // Ignore bad/placeholder references and extreme ratio mismatches.
  const ratio=p/r;
  if(ratio < 0.12 || ratio > 2.5) return 0;
  const pct=Math.round((1-ratio)*100);
  // Discounts above 70% are usually bad market/reference mismatches.
  if(pct < 0 || pct > 70) return 0;
  return pct;
}

function isUsableLiveSkin(s){
  if(!s || s.marketType!=='skin') return false;
  if(!Number.isFinite(Number(s.price)) || Number(s.price)<=0) return false;
  if(!s.weapon || !s.finish) return false;
  return true;
}

function popularityScore(s){
  let score=0;
  const q=Number(s.quantity)||0;
  const p=Number(s.price)||0;
  score += Math.min(q, 5000) / 25;
  if(s.weapon) score += 120;
  if(/AK-47|AWP|M4A1-S|M4A4|Glock-18|USP-S|Desert Eagle|Karambit|Butterfly Knife|M9 Bayonet|Bayonet/i.test(s.weapon||'')) score += 180;
  if(p >= 2 && p <= 1500) score += 40;
  if(s.stattrak) score += 15;
  return score;
}

function skeletonCards(n=8){
  return Array.from({length:n},()=>`<div class="skeleton-card">
    <div class="sk sk-img"></div>
    <div class="sk sk-line mid"></div>
    <div class="sk sk-line short"></div>
    <div class="sk sk-line"></div>
  </div>`).join('');
}
function toast(title,text=''){
  let host=document.getElementById('toastHost');
  if(!host){host=document.createElement('div');host.id='toastHost';document.body.appendChild(host)}
  const el=document.createElement('div');el.className='toast';
  el.innerHTML=`<strong>${title}</strong>${text?`<small>${text}</small>`:''}`;
  host.appendChild(el);setTimeout(()=>el.remove(),3400);
}
function setupMobileNav(){
  const header=document.querySelector('.topbar'); const nav=header?.querySelector('nav'); if(!header||!nav)return;
  if(header.querySelector('.mobile-nav-btn'))return;
  const b=document.createElement('button');b.className='mobile-nav-btn';b.type='button';b.setAttribute('aria-label','Меню');b.textContent='☰';
  b.onclick=()=>nav.classList.toggle('open');
  header.appendChild(b);
  nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>nav.classList.remove('open')));
}
function setLoadingState(){
  const g=$('#popular'); if(g && !(window.LIVE_SKINS||[]).length) g.innerHTML=skeletonCards(8);
  const cg=$('#catalogGrid'); if(cg && !(window.LIVE_SKINS||[]).length) cg.innerHTML=skeletonCards(12);
}

function card(s){return `<article class="card" data-name="${s.name.toLowerCase()}" data-cat="${s.category}">
<button class="fav" data-id="${s.id}" onclick="toggleFav('${s.id}')" title="В избранное">♥</button>
<div class="skin-art"><img src="${s.img}" alt="${s.name}" loading="lazy" onerror="this.style.display='none'"></div>
<div class="skin-name">${s.stattrak?'<span class="st-badge">StatTrak™</span> ':''}${s.name}</div>
<div class="condition">${s.condition||'—'}</div>
<div class="price">${money(s.price)}</div>
${scoreBadge(s)}
${s.live&&s.dealPct>0?`<div class="deal">−${s.dealPct}% к средней Skinport</div>`:''}
<div class="trend ${s.trend7>=0?'up':'down'}">${s.trend7>=0?'▲ +':'▼ '}${s.trend7||0}% vs 30д</div>
<div class="condition">${s.live?`Skinport • ${s.quantity??0} шт.`:'загрузка...'}</div>
<a class="card-btn" style="display:block;text-align:center" href="skin.html?id=${encodeURIComponent(s.id)}">Аналитика и где продать</a></article>`}
function updateLiveStatus(){
  const el=document.getElementById('liveStatus'); if(!el)return;
  const n=(window.LIVE_SKINS||[]).length;
  if(n>0){
    const t=window.LIVE_UPDATED_AT?new Date(window.LIVE_UPDATED_AT).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'';
    el.textContent=`● Skinport LIVE • ${n}${t?' • '+t:''}`;
    el.style.color='#66e39a';
  }else if(window.LIVE_READY===false){
    el.textContent='● Skinport временно недоступен';
    el.style.color='#ff8f8f';
  }else{
    el.textContent='● Подключение к Skinport...';
  }
}


function markSkinportOnline(){
  const count=(window.LIVE_SKINS||[]).length;
  const status=document.getElementById('liveStatus');
  if(status){
    status.textContent=count?`${SF_DIAG.fallback?'CACHE':'Skinport LIVE'} • ${count.toLocaleString('ru-RU')}`:'Skinport LIVE';
    status.style.color='#66e39a';
  }
}

function updateHeroSnapshot(){
  const source=(window.CLEAN_SKINS||window.LIVE_SKINS||[]).filter(isUsableLiveSkin);
  if(!source.length)return;
  const prices=source.map(s=>s.price).filter(Number.isFinite);
  const avg=prices.length?prices.reduce((x,y)=>x+y,0)/prices.length:0;
  const best=source.filter(s=>Number.isFinite(s.dealPct)&&s.dealPct>0&&s.dealPct<=70).sort((a,b)=>(b.dealPct||0)-(a.dealPct||0))[0];
  const cheapestDeal=best||source.slice().sort((a,b)=>a.price-b.price)[0];
  const time=window.LIVE_UPDATED_AT?new Date(window.LIVE_UPDATED_AT).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'сейчас';
  const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v};
  set('heroItems',source.length.toLocaleString('ru-RU'));
  set('heroAvg',money(avg));
  set('heroDeal',best&&best.dealPct>0?`−${best.dealPct}%`:'LIVE');
  set('heroUpdated',time);
  const f=document.getElementById('heroFeatured');
  if(f&&cheapestDeal){
    f.innerHTML=`<div class="feature-kicker">ИНТЕРЕСНОЕ ПРЕДЛОЖЕНИЕ</div><strong>${cheapestDeal.name}</strong><span>${cheapestDeal.condition||'—'} • ${money(cheapestDeal.price)}${cheapestDeal.dealPct>0?` • −${cheapestDeal.dealPct}% к средней`:''}</span>`;
  }
}

function renderHome(){
 let g=$('#popular');
 const live=Array.isArray(window.LIVE_SKINS)?window.LIVE_SKINS:[];
 if(!live.length){
   if(g)g.innerHTML=skeletonCards(8);
   const offers=$('#offers');if(offers)offers.innerHTML='<div class="empty">Получаем реальные цены Skinport...</div>';
   const trends=$('#trendList');if(trends)trends.innerHTML='<div class="empty">Аналитика появится после загрузки рынка.</div>';
   return;
 }
 const pool=live;
 if(g){
   const popular=pool.filter(s=>['AK-47','AWP','M4A1-S','M4A4','Glock-18','USP-S'].includes(s.weapon)).slice(0,8);
   g.innerHTML=(popular.length?popular:pool.slice(0,8)).map(card).join('');
   renderFavStates();
 }
 let o=$('#offers');
 if(o)o.innerHTML=pool.slice().filter(s=>s.price!=null).sort((a,b)=>(a.price??Infinity)-(b.price??Infinity)).slice(0,6).map(s=>`<div class="offer"><strong>${s.name}</strong><span>${money(s.price)}</span><span class="best">Skinport LIVE</span></div>`).join('');
 let t=$('#trendList');
 if(t)t.innerHTML=pool.slice().filter(s=>s.mean&&s.price).sort((a,b)=>(b.dealPct||0)-(a.dealPct||0)).slice(0,5).map(s=>`<div class="trend-row"><span>${s.name}</span><strong class="up">${s.dealPct>0?'−'+s.dealPct+'%':'LIVE'}</strong></div>`).join('');
}
function homeSearch(){let q=$('#homeSearch').value.trim();location.href='catalog.html?q='+encodeURIComponent(q)}

function syncWeaponFilter(){
  const el=$('#weaponFilter'); if(!el)return;
  const source=(window.LIVE_SKINS&&window.LIVE_SKINS.length)?window.LIVE_SKINS:SKINS;
  const current=el.value;
  const weapons=[...new Set(source.map(s=>s.weapon).filter(Boolean))].sort();
  el.innerHTML='<option value="">Все оружие</option>'+weapons.map(w=>`<option value="${w}">${w}</option>`).join('');
  if(weapons.includes(current)) el.value=current;
}

function parseSmartQuery(q){
  let text=String(q||'').trim();
  let condition='';
  const aliases=[['Factory New','\\b(fn|factory new)\\b'],['Minimal Wear','\\b(mw|minimal wear)\\b'],['Field-Tested','\\b(ft|field[- ]tested)\\b'],['Well-Worn','\\b(ww|well[- ]worn)\\b'],['Battle-Scarred','\\b(bs|battle[- ]scarred)\\b']];
  for(const [name,pat] of aliases){const r=new RegExp(pat,'i');if(r.test(text)){condition=name;text=text.replace(r,' ')}}
  const stattrak=/\\b(stattrak|stat trak|st)\\b/i.test(text);
  if(stattrak) text=text.replace(/\\b(stattrak|stat trak|st)\\b/ig,' ');
  const terms=text.toLowerCase().replace(/[|]/g,' ').split(/\\s+/).filter(Boolean);
  return {terms,condition,stattrak};
}
function smartMatch(s,q){
  const p=parseSmartQuery(q);
  const hay=(s.name+' '+s.weapon+' '+s.condition+' '+(s.stattrak?'stattrak':'')).toLowerCase().replace(/[|]/g,' ');
  return p.terms.every(t=>hay.includes(t)) && (!p.condition||s.condition===p.condition) && (!p.stattrak||s.stattrak);
}
function renderCatalog(){
 let grid=$('#catalogGrid');if(!grid)return;
 let params=new URLSearchParams(location.search);
 if(params.get('q'))$('#searchInput').value=params.get('q');
 if(params.get('cat')&&$('#category'))$('#category').value=params.get('cat');
 if(params.get('sort')&&$('#sort'))$('#sort').value=params.get('sort');
 if(params.get('fav')==='1'&&$('#onlyFav'))$('#onlyFav').checked=true;
 const PAGE_SIZE=24; let page=1;
 const run=()=>{
   const source=(window.LIVE_SKINS&&window.LIVE_SKINS.length)?window.LIVE_SKINS:SKINS;
   let q=$('#searchInput').value.trim(),cat=$('#category').value,weapon=$('#weaponFilter')?.value||'',cond=$('#conditionFilter')?.value||'',st=$('#stattrakFilter')?.value||'all',min=+($('#minPrice').value||0),max=+($('#maxPrice').value||999999),sort=$('#sort').value,onlyFav=$('#onlyFav').checked;
   let data=source.filter(s=>smartMatch(s,q)&&(!cat||s.category===cat)&&(!weapon||s.weapon===weapon)&&(!cond||s.condition===cond)&&(st==='all'||(st==='yes'&&s.stattrak)||(st==='no'&&!s.stattrak))&&s.price!=null&&s.price>=min&&s.price<=max&&(!onlyFav||favs().includes(s.id)));
   if(sort==='low')data.sort((a,b)=>a.price-b.price);if(sort==='high')data.sort((a,b)=>b.price-a.price);if(sort==='rise')data.sort((a,b)=>b.trend7-a.trend7);if(sort==='fall')data.sort((a,b)=>a.trend7-b.trend7);if(sort==='deal')data.sort((a,b)=>(b.dealPct||0)-(a.dealPct||0));
   const totalPages=Math.max(1,Math.ceil(data.length/PAGE_SIZE));page=Math.min(page,totalPages);const shown=data.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
   grid.innerHTML=shown.length?shown.map(card).join(''):'<div class="empty">Ничего не найдено.</div>';
   $('#resultCount').textContent=(window.LIVE_SKINS&&window.LIVE_SKINS.length)?`${data.length} реальных Skinport • страница ${page}/${totalPages}`:`${data.length} предметов • подключение к Skinport...`;renderFavStates();
   let pager=$('#pager');if(pager){pager.innerHTML=`<button id="prevPage" ${page<=1?'disabled':''}>← Назад</button><span>${page} / ${totalPages}</span><button id="nextPage" ${page>=totalPages?'disabled':''}>Вперёд →</button>`;$('#prevPage')?.addEventListener('click',()=>{if(page>1){page--;run();scrollTo({top:0,behavior:'smooth'})}});$('#nextPage')?.addEventListener('click',()=>{if(page<totalPages){page++;run();scrollTo({top:0,behavior:'smooth'})}})}
 };
 ['searchInput','category','weaponFilter','conditionFilter','stattrakFilter','minPrice','maxPrice','sort','onlyFav'].forEach(id=>{const el=$('#'+id);if(!el)return;el.addEventListener(id==='onlyFav'?'change':'input',()=>{page=1;run()})});run();document.addEventListener('skinforge-live-ready',()=>{page=1;run()});
}
function chart(canvas,s,days=7){
 let c=canvas,x=c.getContext('2d'),w=c.width=c.clientWidth*devicePixelRatio,h=c.height=c.clientHeight*devicePixelRatio;x.scale(devicePixelRatio,devicePixelRatio);w=c.clientWidth;h=c.clientHeight;x.clearRect(0,0,w,h);
 const hh=s.history;
 let vals;
 if(hh){
   const blocks=days===1?['last_24_hours','last_7_days']:days===7?['last_7_days','last_30_days']:['last_30_days','last_90_days'];
   vals=blocks.map(k=>hh[k]?.avg).filter(v=>v!=null);
   if(vals.length===1) vals=[vals[0]*.98,vals[0]];
 }
 if(!vals||vals.length<2){vals=[s.price*.96,s.price*.98,s.price,s.price*1.01]}
 let min=Math.min(...vals)*.985,max=Math.max(...vals)*1.015;
 x.strokeStyle='#263142';x.lineWidth=1;for(let j=1;j<5;j++){let y=j*h/5;x.beginPath();x.moveTo(0,y);x.lineTo(w,y);x.stroke()}
 x.strokeStyle='#8667ff';x.lineWidth=3;x.beginPath();vals.forEach((v,i)=>{let px=i*w/(vals.length-1),py=h-((v-min)/(max-min))*h*.82-h*.09;i?x.lineTo(px,py):x.moveTo(px,py)});x.stroke();
 x.fillStyle='#8d98aa';x.font='12px Arial';x.fillText(money(max),8,16);x.fillText(money(min),8,h-8)
}
async function loadSteamForSkin(s){
  try{
    const r=await fetch('/api/steam?name='+encodeURIComponent(s.hash));
    if(!r.ok) throw new Error('Steam '+r.status);
    const d=await r.json();
    s.steam=d;
    return d;
  }catch(e){
    console.warn('Steam price unavailable',e);
    s.steam=null;
    return null;
  }
}

function historyStat(s,key,label){
 const h=s.history?.[key];
 return `<div class="stat-box"><span>${label}</span><strong>${h?.avg!=null?money(h.avg):'—'}</strong><small>${h?.volume!=null?`${h.volume} продаж`:'нет данных'}</small></div>`
}

function allSkins(){return (window.LIVE_SKINS&&window.LIVE_SKINS.length)?window.LIVE_SKINS:SKINS}
function findSkinById(id){return allSkins().find(x=>x.id===id)||SKINS.find(x=>x.id===id)}
async function loadMarketPricesForSkin(s){
  s._marketAttempted=true;const hash=s.hash||s.marketHash;
  if(!hash)return null;
  try{const r=await fetch('/api/market-prices?name='+encodeURIComponent(hash));if(!r.ok)throw new Error('Market prices '+r.status);const d=await r.json();s.marketPrices=d.markets||{};const st=s.marketPrices.steam;if(st?.buy)s.steam={success:true,lowest_price:st.buy,reference_type:st.price_type};return d}catch(e){console.warn('Market prices unavailable',e);s.marketPrices={};return null}
}
function historyStat(s,key,label){const h=s.history?.[key];return `<div class="stat-box"><span>${label}</span><strong>${h?.avg!=null?money(h.avg):'—'}</strong><small>${h?.volume!=null?`${h.volume} продаж`:'нет данных'}</small></div>`}
function marketComparisonMarkup(s){
 const hash=s.marketHash||s.hash||s.name,prices=s.marketPrices||{},steam=Number(s.steam?.lowest_price)||Number(prices.steam?.sell)||0,csfloat=Number(prices.csfloat?.sell)||0;
 const rows=[
  {id:'skinport',name:'Skinport',kind:'cash',status:'LIVE',price:Number(s.price)||0,fee:8,readonly:true,url:s.itemPage||s.marketPage||'https://skinport.com/market'},
  {id:'steam',name:'Steam Market',kind:'wallet',status:steam?(prices.steam?.price_type||'LIVE'):'Цена временно недоступна',price:steam,fee:15,url:'https://steamcommunity.com/market/listings/730/'+encodeURIComponent(hash)},
  {id:'csfloat',name:'CSFloat',kind:'cash',status:csfloat?'Лучший ордер':'Цена временно недоступна',price:csfloat,fee:2,url:'https://csfloat.com/'},
  {id:'dmarket',name:'DMarket',kind:'cash',status:'Цена временно недоступна',price:0,fee:2,disabled:true,url:'https://dmarket.com/ingame-items/item-list/csgo-skins'}
 ];
 return `<section class="market-compare" id="marketCompare"><div class="market-compare-head"><div><div class="eyebrow">AEROX SELL COMPARE</div><h3>Где продать выгоднее</h3><p>Сравнивай не цену на витрине, а сумму после комиссии.</p></div><div class="market-best-result" id="marketBest">Считаем лучший вариант…</div></div><div class="market-compare-table"><div class="market-compare-row market-compare-labels"><span>Площадка</span><span>Цена</span><span>Комиссия</span><span>Получишь</span><span></span></div>${rows.map(r=>`<div class="market-compare-row${r.disabled?' market-unavailable':''}" data-market="${r.id}" data-kind="${r.kind}"><span class="market-title"><strong>${r.name}</strong><small>${r.status}${r.kind==='wallet'?' • Steam Wallet':' • реальные деньги'}</small></span><label><small>Цена, $</small><input class="market-price" type="number" min="0" step="0.01" value="${r.price||''}" placeholder="Нет данных" readonly></label><label><small>Комиссия, %</small><input class="market-fee" type="number" min="0" max="40" step="0.5" value="${r.fee}" ${r.disabled?'disabled':''}></label><strong class="market-net">${r.disabled?'Недоступно':'—'}</strong><a class="secondary market-go" href="${r.url}" target="_blank" rel="noopener noreferrer">Открыть</a></div>`).join('')}</div><div class="notice">Skinport — текущая цена, CSFloat — лучший ордер на покупку, Steam — реальная средняя цена последних продаж в Steam Wallet. DMarket честно помечен как недоступный, пока нет официального API-ключа. Цены обновляются автоматически и не выдумываются.</div></section>`;
}
function bindMarketComparison(s){
 const box=$('#marketCompare');if(!box)return;s.marketDraft=s.marketDraft||{};
 const update=()=>{
  let best=null;
  $$('.market-compare-row[data-market]',box).forEach(row=>{
   const price=Math.max(0,Number($('.market-price',row)?.value)||0),fee=Math.max(0,Math.min(40,Number($('.market-fee',row)?.value)||0)),net=price*(1-fee/100);
   $('.market-net',row).textContent=price?money(net):(row.classList.contains('market-unavailable')?'Недоступно':'—');row.classList.remove('market-best');
   if(row.dataset.kind==='cash'&&price>0&&(!best||net>best.net))best={row,net,name:$('.market-title strong',row).textContent};
  });
  if(best){best.row.classList.add('market-best');$('#marketBest').innerHTML=`<small>Лучший cash-out</small><strong>${best.name} · ${money(best.net)}</strong>`}else $('#marketBest').textContent='Цены временно недоступны';
 };
 $$('input',box).forEach(x=>x.addEventListener('input',update));update();
}
function renderSkin(){
 const root=$('#skinDetail');if(!root)return;const query=new URLSearchParams(location.search),id=query.get('id'),requestedHash=query.get('hash');
 const draw=()=>{
   const s=requestedHash?allSkins().find(x=>(x.marketHash||x.hash)===requestedHash):(id?findSkinById(id):allSkins()[0]);if(!s){root.innerHTML='<div class="detail-loading" role="status"><div class="detail-loading-art"></div><div><div class="detail-loading-line wide"></div><div class="detail-loading-line"></div><div class="detail-loading-line price"></div><p>Загружаем выбранный скин и актуальные цены…</p></div></div>';return}
   renderHistorySummary(s.history||null);
   document.title=s.name+' — SkinForge';const st=s.steam?.lowest_price;const diff=(s.price!=null&&st!=null)?st-s.price:null;const steamUrl='https://steamcommunity.com/market/listings/730/'+encodeURIComponent(s.hash);
   const dm=dealScore(s);root.innerHTML=`<div class="detail-art"><img src="${s.img}" alt="${s.name}"></div><div><div class="eyebrow">${s.category}${s.stattrak?' • StatTrak™':''}</div><h1 style="margin:7px 0 4px">${s.name}</h1><div class="muted">${s.condition}</div><div class="big-price">${money(s.price)}</div><div class="trend ${s.trend7>=0?'up':'down'}">${s.trend7>=0?'▲ +':'▼ '}${s.trend7}% vs 30д</div><div class="notice">Skinport LIVE • ${s.quantity??0} шт.</div>
   <div class="score-panel ${scoreClass(dm)}"><div><span>SkinForge Deal Score</span><strong>${dm.score}/100 · ${dm.verdict}</strong></div><div class="score-grid"><span>Справедливая цена<b>${money(dm.reference)}</b></span><span>Ликвидность<b>${dm.liquidity}/25</b></span><span>Риск за 7 дней<b>${dm.risk}</b></span><span>Оценка после комиссии и риска<b class="${dm.afterLock>=0?'up':'down'}">${dm.afterLock>=0?'+':''}${money(dm.afterLock)}</b></span></div><small>Расчёт ориентировочный: после получения CS2-предмет нельзя передать дальше примерно 7 дней, поэтому SkinForge резервирует возможное движение цены за этот срок.</small></div>
   <div class="quick-actions"><button class="ghost" onclick="toggleFav('${s.id}')">♥ В избранное</button><button class="primary" id="alertAdd">🔔 Следить за ценой</button></div>
   <div class="portfolio-add"><input id="pfQty" type="number" min="0.01" step="1" value="1"><input id="pfBuy" type="number" min="0" step="0.01" value="${s.price??''}"><button class="primary" id="pfAdd">+ В портфель</button></div>
   <div class="periods"><button data-days="1">24ч</button><button data-days="7" class="active">7д</button><button data-days="30">30д</button></div><div class="chart"><canvas id="priceChart"></canvas></div>
   <h3>Статистика Skinport</h3><div class="stats-grid">${historyStat(s,'last_24_hours','24 часа')}${historyStat(s,'last_7_days','7 дней')}${historyStat(s,'last_30_days','30 дней')}${historyStat(s,'last_90_days','90 дней')}</div>
   <div class="panel"><div class="market-row"><strong>Минимальная</strong><span>${money(s.price)}</span></div><div class="market-row"><strong>Средняя</strong><span>${money(s.mean)}</span></div><div class="market-row"><strong>Медиана</strong><span>${money(s.median)}</span></div><div class="market-row"><strong>Suggested</strong><span>${money(s.suggested)}</span></div></div>
   <h3>Сравнение со Steam</h3><div class="panel"><div class="market-row"><strong>Steam lowest</strong><span>${s.steam?money(st):'загрузка...'}</span><a class="primary" href="${steamUrl}" target="_blank">Steam</a></div><div class="market-row"><strong>Разница Steam − Skinport</strong><span class="${diff!=null?(diff>=0?'up':'down'):''}">${diff==null?'—':`${diff>=0?'+':''}${money(diff)}`}</span></div></div><p class="muted">Steam Wallet и cash-market Skinport — разные типы стоимости.</p>${marketComparisonMarkup(s)}</div>`;
   const cv=$('#priceChart');if(cv)chart(cv,s,7);$$('.periods button').forEach(b=>b.onclick=()=>{$$('.periods button').forEach(x=>x.classList.remove('active'));b.classList.add('active');chart(cv,s,+b.dataset.days)});
   $('#pfAdd')?.addEventListener('click',()=>{addPortfolioLive(s.id,+$('#pfQty').value,+$('#pfBuy').value);$('#pfAdd').textContent='✓ Добавлено'});
   $('#alertAdd')?.addEventListener('click',()=>{const target=prompt('Уведомить, когда цена станет ниже ($):',String(s.price??''));if(target&&Number(target)>0){saveAlert(s,Number(target),'below');$('#alertAdd').textContent='✓ Уведомление создано'}});
   bindMarketComparison(s);
   if(!s._marketAttempted) loadMarketPricesForSkin(s).then(()=>draw());
 };
 draw();document.addEventListener('skinforge-live-ready',draw);document.addEventListener('skinforge-history-ready',draw);
}

function renderDealRadar(){const root=$('#dealRadar');if(!root)return;const draw=()=>{const source=(window.CLEAN_SKINS||window.LIVE_SKINS||[]).filter(isUsableLiveSkin),fee=Number($('#radarFee')?.value||8),rows=source.map(s=>({s,m:dealScore(s,fee)})).filter(x=>x.m.discount>0&&x.s.price>=1&&x.m.afterLock>=.5).sort((a,b)=>b.m.score-a.m.score).slice(0,30);root.innerHTML=rows.length?rows.map(({s,m},i)=>`<a class="radar-row" href="skin.html?id=${encodeURIComponent(s.id)}"><span class="radar-rank">#${i+1}</span><img src="${s.img}" alt="" loading="lazy"><span class="radar-name"><strong>${s.name}</strong><small>${s.condition} · ${s.quantity||0} шт.</small></span><span>${money(s.price)}<small>сейчас</small></span><span class="${m.afterLock>=0?'up':'down'}">${m.afterLock>=0?'+':''}${money(m.afterLock)}<small>после комиссии и риска</small></span>${scoreBadge(s,fee)}</a>`).join(''):'<div class="empty">Нет сделок с достаточным запасом после комиссии и 7-дневного риска.</div>'};draw();document.addEventListener('skinforge-live-ready',draw);document.addEventListener('skinforge-history-ready',draw);$('#radarFee')?.addEventListener('input',draw)}
async function renderArbitrage(){
  const root=$('#arbRoot'); if(!root)return;

  const drawRows=(items)=>{
    root.innerHTML=`<div class="arb-toolbar">
      <div><strong>Арбитраж-сканер</strong><div class="muted">Сравнение Skinport и Steam для 8 выбранных предметов.</div></div>
      <button class="primary" id="scanSteam">Проверить Steam</button>
    </div>
    <div class="arb-table">
      <div class="arb-head"><span>Скин</span><span>Skinport</span><span>Steam</span><span>Разница</span><span>Статус</span></div>
      ${items.map(s=>`<div class="arb-row" data-id="${s.id}">
        <span><strong>${s.stattrak?'StatTrak™ ':''}${s.name}</strong><small>${s.condition}</small></span>
        <span>${s.live?money(s.price):'—'}</span>
        <span class="steam-cell">—</span>
        <span class="diff-cell">—</span>
        <span class="status-cell">${s.live?'готов':'нет Skinport'}</span>
      </div>`).join('')}
    </div>
    <div class="notice">Важно: Steam использует баланс Steam Wallet, Skinport — cash market. Разница цен не равна гарантированной прибыли.</div>`;

    $('#scanSteam')?.addEventListener('click',async()=>{
      const btn=$('#scanSteam'); btn.disabled=true; btn.textContent='Проверяю...';
      const names=items.filter(s=>s.live).map(s=>s.hash).slice(0,8);
      try{
        const r=await fetch('/api/steam-batch?names='+encodeURIComponent(names.join('|')));
        if(!r.ok) throw new Error('Steam batch '+r.status);
        const data=await r.json();
        const byName=new Map(data.map(x=>[x.name,x]));
        items.forEach(s=>{
          const row=$(`.arb-row[data-id="${s.id}"]`); if(!row)return;
          const d=byName.get(s.hash);
          const st=d?.lowest_price;
          const diff=(st&&s.price)?st-s.price:null;
          $('.steam-cell',row).textContent=st?money(st):'—';
          $('.diff-cell',row).textContent=diff!==null?`${diff>=0?'+':''}${money(diff)}`:'—';
          const stat=$('.status-cell',row);
          if(diff!==null){
            stat.textContent=diff>0?'Steam выше':'Skinport выше';
            stat.className='status-cell '+(diff>0?'up':'down');
          }else stat.textContent=d?.error?'Steam limit':'нет данных';
        });
      }catch(e){
        console.warn(e);
      }finally{
        btn.disabled=false;btn.textContent='Проверить Steam';
      }
    });
  };

  const pick=()=>allSkins().filter(s=>s.live).slice().sort((a,b)=>(b.dealPct||0)-(a.dealPct||0)).slice(0,8);
  drawRows(pick());
  document.addEventListener('skinforge-live-ready',()=>drawRows(pick()),{once:true});
}


function renderPortfolio(){
  const root=$('#portfolioRoot'); if(!root)return;

  const draw=()=>{
    const p=portfolio();
    const source=allSkins();const rows=p.map(e=>({e,s:source.find(x=>x.id===e.id)||source.find(x=>x.hash===e.hash)})).filter(x=>x.s);
    let invested=0,current=0;
    rows.forEach(({e,s})=>{
      invested+=(Number(e.qty)||0)*(Number(e.buyPrice)||0);
      if(s.live&&s.price!=null) current+=(Number(e.qty)||0)*Number(s.price);
    });
    const pnl=current-invested;
    const pnlPct=invested?((pnl/invested)*100):0;

    root.innerHTML=`
      <div class="portfolio-summary">
        <div class="stat-box"><span>Вложено</span><strong>${money(invested)}</strong></div>
        <div class="stat-box"><span>Текущая стоимость</span><strong>${window.LIVE_READY===true?money(current):'загрузка...'}</strong></div>
        <div class="stat-box"><span>P/L</span><strong class="${pnl>=0?'up':'down'}">${window.LIVE_READY===true?`${pnl>=0?'+':''}${money(pnl)}`:'—'}</strong></div>
        <div class="stat-box"><span>P/L %</span><strong class="${pnlPct>=0?'up':'down'}">${window.LIVE_READY===true?`${pnlPct>=0?'+':''}${pnlPct.toFixed(1)}%`:'—'}</strong></div>
      </div>
      <div class="portfolio-actions">
        <a class="primary" href="catalog.html">+ Добавить скин</a>
        ${rows.length?'<button id="clearPortfolio">Очистить портфель</button>':''}
      </div>
      ${rows.length?`<div class="arb-table">
        <div class="arb-head portfolio-head"><span>Скин</span><span>Кол-во</span><span>Покупка</span><span>Сейчас</span><span>P/L</span><span></span></div>
        ${rows.map(({e,s})=>{
          const qty=Number(e.qty)||0,buy=Number(e.buyPrice)||0,now=s.live?s.price:null;
          const rowPnl=now==null?null:(now-buy)*qty;
          return `<div class="arb-row portfolio-row">
            <span><strong>${s.stattrak?'StatTrak™ ':''}${s.name}</strong><small>${s.condition}</small></span>
            <span>${qty}</span>
            <span>${money(buy)}</span>
            <span>${money(now)}</span>
            <span class="${rowPnl==null?'':(rowPnl>=0?'up':'down')}">${rowPnl==null?'—':`${rowPnl>=0?'+':''}${money(rowPnl)}`}</span>
            <span><button class="danger mini-remove" data-id="${s.id}">Удалить</button></span>
          </div>`
        }).join('')}
      </div>`:`<div class="empty">Портфель пуст. Открой любой реальный скин и нажми «+ В портфель».</div>`}
      <div class="notice">Данные портфеля сохраняются только в этом браузере через localStorage.</div>`;

    $$('.mini-remove').forEach(b=>b.onclick=()=>removePortfolio(b.dataset.id));
    $('#clearPortfolio')?.addEventListener('click',clearPortfolio);
  };

  draw();
  document.addEventListener('skinforge-live-ready',draw);
  document.addEventListener('skinforge-portfolio-change',draw);
}

function portfolioSource(){return allSkins()}
function addPortfolioLive(id,qty=1,buyPrice=null){
 const s=findSkinById(id);if(!s)return;let p=portfolio(),e=p.find(x=>x.id===id);qty=Math.max(.01,Number(qty)||1);buyPrice=Number(buyPrice);if(!Number.isFinite(buyPrice)||buyPrice<=0)buyPrice=Number(s.price)||0;
 if(e){const old=Number(e.qty)||0,n=old+qty;e.buyPrice=((Number(e.buyPrice)||0)*old+buyPrice*qty)/n;e.qty=n;e.hash=s.hash;e.name=s.name}else p.push({id,hash:s.hash,name:s.name,qty,buyPrice,addedAt:Date.now()});setPortfolio(p);document.dispatchEvent(new Event('skinforge-portfolio-change'));
}
function alerts(){return JSON.parse(localStorage.getItem('skinforge_alerts')||'[]')}
function setAlerts(v){localStorage.setItem('skinforge_alerts',JSON.stringify(v))}
function saveAlert(s,target,direction='below'){let a=alerts();a.push({id:'a'+Date.now(),skinId:s.id,hash:s.hash,name:s.name,condition:s.condition,target:Number(target),direction,createdAt:Date.now(),triggered:false});setAlerts(a);document.dispatchEvent(new Event('skinforge-alerts-change'))}
function removeAlert(id){setAlerts(alerts().filter(a=>a.id!==id));document.dispatchEvent(new Event('skinforge-alerts-change'))}
function toast(msg){let t=$('#sfToast');if(!t){t=document.createElement('div');t.id='sfToast';t.className='sf-toast';document.body.appendChild(t)}t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),4500)}
function checkPriceAlerts(){const source=window.LIVE_SKINS||[];let a=alerts(),changed=false;a.forEach(x=>{const s=source.find(k=>k.hash===x.hash||k.id===x.skinId);if(!s||s.price==null)return;const hit=x.direction==='below'?s.price<=x.target:s.price>=x.target;if(hit&&!x.triggered){x.triggered=true;x.triggeredAt=Date.now();x.lastPrice=s.price;changed=true;setTimeout(()=>toast(`🔔 ${s.name}: ${money(s.price)} — цель ${money(x.target)}`),200)}});if(changed)setAlerts(a)}
function renderFavorites(){const root=$('#favoritesRoot');if(!root)return;const draw=()=>{const source=allSkins(),set=new Set(favs()),items=source.filter(s=>set.has(s.id));root.innerHTML=items.length?`<div class="cards">${items.map(card).join('')}</div>`:'<div class="empty">Избранное пусто. Добавь ♥ в каталоге.</div>';renderFavStates()};draw();document.addEventListener('skinforge-live-ready',draw)}
function renderAlerts(){const root=$('#alertsRoot');if(!root)return;const draw=()=>{const a=alerts();root.innerHTML=a.length?`<div class="arb-table"><div class="arb-head"><span>Скин</span><span>Условие</span><span>Цель</span><span>Статус</span><span></span></div>${a.map(x=>`<div class="arb-row"><span><strong>${x.name}</strong><small>${x.condition||''}</small></span><span>${x.direction==='below'?'Цена ≤':'Цена ≥'}</span><span>${money(x.target)}</span><span class="${x.triggered?'up':''}">${x.triggered?'Сработало':'Активно'}</span><span><button class="danger alert-remove" data-id="${x.id}">Удалить</button></span></div>`).join('')}</div>`:'<div class="empty">Уведомлений пока нет. Создай его на странице скина.</div>';$$('.alert-remove').forEach(b=>b.onclick=()=>removeAlert(b.dataset.id))};draw();document.addEventListener('skinforge-alerts-change',draw);document.addEventListener('skinforge-live-ready',draw)}
function renderAnalytics(){const root=$('#analyticsRoot');if(!root)return;const draw=()=>{const source=(window.CLEAN_SKINS||window.LIVE_SKINS||[]).filter(isUsableLiveSkin);if(!source.length){root.innerHTML='<div class="empty">Загрузка аналитики Skinport...</div>';return}const deals=source.filter(s=>s.mean&&s.price).sort((a,b)=>(b.dealPct||0)-(a.dealPct||0)).slice(0,10);const up=source.filter(s=>s.history).sort((a,b)=>b.trend7-a.trend7).slice(0,10);const down=source.filter(s=>s.history).sort((a,b)=>a.trend7-b.trend7).slice(0,10);const table=(items,mode)=>`<div class="rank-list">${items.map((s,i)=>`<a href="skin.html?id=${s.id}" class="rank-row"><span>#${i+1} ${s.name}<small>${s.condition}</small></span><strong class="${mode==='down'?'down':'up'}">${mode==='deal'?'−'+(s.dealPct||0)+'%':(s.trend7>=0?'+':'')+s.trend7+'%'}</strong><em>${money(s.price)}</em></a>`).join('')}</div>`;root.innerHTML=`<div class="analytics-grid"><section class="panel"><h2>🔥 Ниже средней</h2>${table(deals,'deal')}</section><section class="panel"><h2>📈 Рост 7д vs 30д</h2>${table(up,'up')}</section><section class="panel"><h2>📉 Падение 7д vs 30д</h2>${table(down,'down')}</section></div>`};draw();document.addEventListener('skinforge-live-ready',draw);document.addEventListener('skinforge-history-ready',draw)}
function renderCalculator(){const root=$('#calcRoot');if(!root)return;root.innerHTML=`<div class="calc-grid"><label>Цена покупки $<input id="cBuy" type="number" value="100" step="0.01"></label><label>Цена продажи $<input id="cSell" type="number" value="120" step="0.01"></label><label>Количество<input id="cQty" type="number" value="1" min="1"></label><label>Комиссия покупки %<input id="cBuyFee" type="number" value="0" step="0.1"></label><label>Комиссия продажи %<input id="cSellFee" type="number" value="12" step="0.1"></label><label>Доп. расходы $<input id="cExtra" type="number" value="0" step="0.01"></label></div><div id="calcResult" class="portfolio-summary"></div>`;const calc=()=>{const buy=+$('#cBuy').value||0,sell=+$('#cSell').value||0,qty=+$('#cQty').value||0,bf=+$('#cBuyFee').value||0,sf=+$('#cSellFee').value||0,ex=+$('#cExtra').value||0;const cost=buy*qty*(1+bf/100)+ex,net=sell*qty*(1-sf/100),profit=net-cost,roi=cost?profit/cost*100:0,be=qty?(cost/qty)/(1-sf/100):0;$('#calcResult').innerHTML=`<div class="stat-box"><span>Затраты</span><strong>${money(cost)}</strong></div><div class="stat-box"><span>Получишь после комиссии</span><strong>${money(net)}</strong></div><div class="stat-box"><span>Чистая прибыль</span><strong class="${profit>=0?'up':'down'}">${profit>=0?'+':''}${money(profit)}</strong></div><div class="stat-box"><span>ROI</span><strong class="${roi>=0?'up':'down'}">${roi.toFixed(1)}%</strong></div><div class="stat-box"><span>Безубыточная продажа</span><strong>${money(be)}</strong></div>`};$$('#calcRoot input').forEach(i=>i.addEventListener('input',calc));calc()}

function renderNews(){let r=$('#newsGrid');if(r)r.innerHTML=NEWS.map(n=>`<article class="news-card"><div class="news-meta">${n.date} • ${n.tag}</div><h3>${n.title}</h3><p>${n.text}</p><a href="${n.url}" target="_blank">Открыть источник</a></article>`).join('')}
document.addEventListener('DOMContentLoaded',()=>{
  setupMobileNav();setLoadingState();checkSystemStatus();
  renderHome();renderCatalog();renderSkin();renderNews();renderArbitrage();renderPortfolio();renderFavorites();renderAlerts();renderAnalytics();renderCalculator();renderDealRadar();updateLiveStatus();updateHeroSnapshot();

  document.addEventListener('skinforge-live-ready',()=>{syncWeaponFilter();renderHome();updateLiveStatus();updateHeroSnapshot()});
  document.addEventListener('skinforge-history-ready',renderHome);

  loadLiveData();

  // Автообновление цен каждые 5 минут.
  setInterval(()=>loadLiveData(),5*60*1000);

  // Небольшой обратный отсчёт до следующего обновления, если блок есть на странице.
  let next=Date.now()+5*60*1000;
  document.addEventListener('skinforge-live-ready',()=>{next=Date.now()+5*60*1000});
  setInterval(()=>{
    const el=$('#refreshCountdown'); if(!el)return;
    const sec=Math.max(0,Math.round((next-Date.now())/1000));
    const m=Math.floor(sec/60), s=String(sec%60).padStart(2,'0');
    el.textContent=`Следующее обновление: ${m}:${s}`;
  },1000);
});
