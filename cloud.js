(()=>{const theme=document.createElement('link');theme.rel='stylesheet';theme.href='/aerox-global.css?v=201';document.head.appendChild(theme);function brand(){try{document.title=document.title.replace(/SkinForge/gi,'AEROX');document.querySelectorAll('.logo,.brand').forEach(el=>{el.textContent='AEROX'});const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;while(n=walker.nextNode()){const p=n.parentElement;if(!p||['SCRIPT','STYLE','NOSCRIPT'].includes(p.tagName))continue;if(/SkinForge/i.test(n.nodeValue||''))n.nodeValue=n.nodeValue.replace(/SkinForge/gi,'AEROX')}}catch(e){}}function hardenSkinLinks(root=document){try{const live=Array.isArray(window.LIVE_SKINS)?window.LIVE_SKINS:[];root.querySelectorAll?.('a[href*="skin.html?id="]').forEach(a=>{if(/Аналитика\s+и\s+где\s+продать/i.test(a.textContent||''))a.textContent='Аналитика';let u;try{u=new URL(a.getAttribute('href'),location.href)}catch(e){return}if(u.searchParams.get('hash'))return;const id=u.searchParams.get('id')||'';const card=a.closest('.card,.result-card,.skin-card,.related-card');const name=(card?.dataset?.name||card?.querySelector('.skin-name,strong')?.textContent||'').trim().toLowerCase();const condition=(card?.querySelector('.condition')?.textContent||card?.querySelector('small')?.textContent||'').trim().toLowerCase();let candidates=live.filter(s=>String(s?.id||'')===id);let s=candidates.find(x=>(!name||String(x?.name||'').trim().toLowerCase()===name)&&(!condition||String(x?.condition||'').trim().toLowerCase()===condition))||candidates[0];if(!s&&name)s=live.find(x=>String(x?.name||'').trim().toLowerCase()===name&&(!condition||String(x?.condition||'').trim().toLowerCase()===condition));const hash=s?.marketHash||s?.hash;if(hash){u.searchParams.set('hash',hash);a.setAttribute('href',u.pathname.replace(/^\//,'')+'?'+u.searchParams.toString())}})}catch(e){}}function readyUi(){brand();hardenSkinLinks()}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',readyUi);else readyUi();document.addEventListener('skinforge-live-ready',()=>setTimeout(()=>hardenSkinLinks(),0));document.addEventListener('skinforge-images-ready',()=>setTimeout(()=>hardenSkinLinks(),0));const observer=new MutationObserver(m=>{for(const x of m){for(const n of x.addedNodes){if(n&&n.nodeType===1)hardenSkinLinks(n)}}});if(document.documentElement)observer.observe(document.documentElement,{subtree:true,childList:true});
const KEYS=['skinforge_favs','skinforge_portfolio','skinforge_alerts'];
let ready=false,timer=null,internal=false,saving=false,again=false,version=null;
const originalSet=Storage.prototype.setItem;
function read(key){try{const x=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(x)?x:[]}catch(e){return[]}}
function notice(message){let el=document.getElementById('cloudSyncNotice');if(!el){el=document.createElement('div');el.id='cloudSyncNotice';el.className='notice';el.setAttribute('role','status');(document.querySelector('main')||document.body).prepend(el)}el.textContent=message}
function conflict(message){
 ready=false;
 const backup=JSON.stringify({favorites:read(KEYS[0]),portfolio:read(KEYS[1]),alerts:read(KEYS[2])});
 originalSet.call(localStorage,'aerox_conflict_backup',backup);
 notice(message);
 const el=document.getElementById('cloudSyncNotice');
 const download=document.createElement('button');download.textContent='Скачать локальную копию';
 download.onclick=()=>{const url=URL.createObjectURL(new Blob([backup],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='aerox-local-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};el.append(' ',download);
 const reload=document.createElement('button');reload.textContent='Загрузить версию аккаунта';
 reload.onclick=async()=>{reload.disabled=true;try{const r=await fetch('/api/user-data',{credentials:'same-origin'});if(!r.ok)throw Error('load');storeCloud(await r.json());ready=true;notice('Загружена версия аккаунта. Предыдущая локальная копия сохранена в браузере.')}catch(e){reload.disabled=false;notice('Не удалось загрузить аккаунт. Локальная копия сохранена.')}};el.append(' ',reload);
}
function changed(){document.dispatchEvent(new Event('skinforge-cloud-ready'));document.dispatchEvent(new Event('skinforge-watchlist-change'));document.dispatchEvent(new Event('skinforge-alerts-change'));document.dispatchEvent(new Event('skinforge-portfolio-change'))}
function storeCloud(c){internal=true;try{for(const [i,key] of KEYS.entries())originalSet.call(localStorage,key,JSON.stringify(c[['favorites','portfolio','alerts'][i]]||[]));originalSet.call(localStorage,'aerox_sync_version',c.updated_at||'');originalSet.call(localStorage,'aerox_sync_dirty','0')}finally{internal=false}version=c.updated_at||null;changed()}
async function push(){
 if(!ready)return;if(saving){again=true;return}saving=true;
 const snapshot=KEYS.map(read);
 try{
  const r=await fetch('/api/user-data',{method:'PUT',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({favorites:snapshot[0],portfolio:snapshot[1],alerts:snapshot[2],expected_updated_at:version})});
  if(r.status===409){conflict('Данные изменились на другом устройстве. Локальная копия сохранена; выбери дальнейшее действие.');return}
  if(!r.ok)throw Error('sync '+r.status);
  const c=await r.json();version=c.updated_at;
  originalSet.call(localStorage,'aerox_sync_version',version||'');
  const unchanged=KEYS.every((key,i)=>JSON.stringify(read(key))===JSON.stringify(snapshot[i]));
  if(unchanged){originalSet.call(localStorage,'aerox_sync_dirty','0');const el=document.getElementById('cloudSyncNotice');if(el)el.textContent='Изменения сохранены в аккаунте.'}else again=true;
 }catch(e){notice('Изменения сохранены в браузере, но не отправлены в аккаунт. Повторим при восстановлении соединения.')}
 finally{saving=false;if(again&&ready){again=false;queue()}}
}
function queue(){if(!ready)return;clearTimeout(timer);timer=setTimeout(push,350)}
Storage.prototype.setItem=function(key,value){originalSet.call(this,key,value);if(this===localStorage&&KEYS.includes(String(key))&&!internal){originalSet.call(localStorage,'aerox_sync_dirty','1');queue()}};
async function init(){
 readyUi();
 try{
  const me=await fetch('/api/me',{credentials:'same-origin'}).then(r=>r.json());
  const owner=me.authenticated?String(me.profile?.steamid||''):'guest';if(!owner)return;
  const prior=localStorage.getItem('aerox_data_owner');
  if(prior&&prior!==owner){
   originalSet.call(localStorage,'aerox_backup_'+prior,JSON.stringify({data:KEYS.map(read),version:localStorage.getItem('aerox_sync_version'),dirty:localStorage.getItem('aerox_sync_dirty')}));
   const backup=JSON.parse(localStorage.getItem('aerox_backup_'+owner)||'null');
   internal=true;for(const[i,key]of KEYS.entries())originalSet.call(localStorage,key,JSON.stringify(backup?.data?.[i]||[]));internal=false;
   originalSet.call(localStorage,'aerox_sync_version',backup?.version||'');originalSet.call(localStorage,'aerox_sync_dirty',backup?.dirty||'0');changed();
  }
  originalSet.call(localStorage,'aerox_data_owner',owner);
  if(!me.authenticated)return;
  const r=await fetch('/api/user-data',{credentials:'same-origin'});if(!r.ok)throw Error('load');
  const c=await r.json();version=c.updated_at||null;
  const dirty=localStorage.getItem('aerox_sync_dirty')==='1';
  const known=localStorage.getItem('aerox_sync_version')||null;
  if(c.updated_at&&dirty&&known!==c.updated_at){
   originalSet.call(localStorage,'aerox_conflict_backup',JSON.stringify(KEYS.map(read)));
   conflict('Есть несинхронизированные изменения и новая версия в аккаунте. Локальная копия сохранена; выбери дальнейшее действие.');return;
  }
  if(c.updated_at&&!dirty)storeCloud(c);
  ready=true;window.SF_CLOUD_READY=true;changed();
  if(dirty||!c.updated_at)await push();
 }catch(e){internal=false;notice('Облачная синхронизация недоступна. Работаем с данными этого браузера.')}
}
window.addEventListener('online',()=>{if(ready)queue()});
if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',init);else init();
})();
