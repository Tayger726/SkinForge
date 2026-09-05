const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { URL } = require('url');

const NODE_ENV = process.env.NODE_ENV || 'development';
const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 3000);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

function log(level, message, meta={}) {
  const levels = {error:0,warn:1,info:2,debug:3};
  if ((levels[level] ?? 2) > (levels[LOG_LEVEL] ?? 2)) return;
  const row = {time:new Date().toISOString(), level, message, ...meta};
  console.log(JSON.stringify(row));
}

function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','SAMEORIGIN');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy','cross-origin');
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  if (NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security','max-age=15552000; includeSubDomains');
  }
}



const ROOT = __dirname;
const CACHE_MS = 5 * 60 * 1000;
const cache = new Map();
const skinforgeDiagnostics = {
  started_at: new Date().toISOString(),
  skinport: { ok: null, last_success: null, last_error: null, item_count: 0 },
  steam: { ok: null, last_success: null, last_error: null }
};
let lastGoodItems = null;
let lastGoodItemsAt = null;

function send(res, status, body, type='application/json; charset=utf-8') {
  res.writeHead(status, {'Content-Type': type, 'Cache-Control': 'no-store'});
  res.end(body);
}
function json(res, status, data) { send(res, status, JSON.stringify(data)); }

async function skinportFetch(endpoint, params={}) {
  const u = new URL('https://api.skinport.com' + endpoint);
  u.searchParams.set('app_id', '730');
  u.searchParams.set('currency', 'USD');
  Object.entries(params).forEach(([k,v]) => {
    if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, v);
  });

  const key = u.toString();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.time < CACHE_MS) return hit.data;

  const response = await fetch(u, {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'br'
    }
  });
  if (!response.ok) throw new Error(`Skinport HTTP ${response.status}`);
  const data = await response.json();
  cache.set(key, {time: Date.now(), data});
  if (endpoint.includes('/v1/items') && Array.isArray(data)) {
      lastGoodItems = data;
      lastGoodItemsAt = new Date().toISOString();
      skinforgeDiagnostics.skinport.ok = true;
      skinforgeDiagnostics.skinport.last_success = lastGoodItemsAt;
      skinforgeDiagnostics.skinport.last_error = null;
      skinforgeDiagnostics.skinport.item_count = data.length;
    }
    return data;
}


function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

function parseSteamMoney(v){
  if(!v) return null;
  const cleaned=String(v).replace(/[^0-9.,]/g,'').replace(/,/g,'');
  const n=parseFloat(cleaned);
  return Number.isFinite(n)?n:null;
}

async function steamPrice(name){
  const key='steam:'+name;
  const hit=cache.get(key);
  if(hit && Date.now()-hit.time < 10*60*1000) return hit.data;

  const u=new URL('https://steamcommunity.com/market/priceoverview/');
  u.searchParams.set('appid','730');
  u.searchParams.set('currency','1');
  u.searchParams.set('country','US');
  u.searchParams.set('market_hash_name',name);

  const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0','Accept':'application/json'}});
  if(!r.ok) throw new Error(`Steam HTTP ${r.status}`);
  const raw=await r.json();
  const data={
    success:!!raw.success,
    lowest_price:parseSteamMoney(raw.lowest_price),
    median_price:parseSteamMoney(raw.median_price),
    volume:raw.volume||null,
    raw
  };
  cache.set(key,{time:Date.now(),data});
  skinforgeDiagnostics.steam.ok=!!data.success;
  skinforgeDiagnostics.steam.last_success=new Date().toISOString();
  skinforgeDiagnostics.steam.last_error=null;
  return data;
}

async function api(req, res, u) {
  try {
    if (u.pathname === '/api/ready') {
      return json(res, 200, {
        ok:true,
        service:'SkinForge v14',
        ready:true,
        skinport_cached:Array.isArray(lastGoodItems),
        timestamp:new Date().toISOString()
      });
    }

    if (u.pathname === '/api/health') {
      return json(res, 200, {ok:true, service:'SkinForge v14', env:NODE_ENV, uptime_sec:Math.floor(process.uptime())});
    }

    if (u.pathname === '/api/status') {
      return json(res, 200, {
        ok:true,
        service:'SkinForge v14',
        uptime_sec:Math.floor(process.uptime()),
        now:new Date().toISOString(),
        node:process.version,
        skinport:skinforgeDiagnostics.skinport,
        steam:skinforgeDiagnostics.steam,
        cache:{
          has_last_good_items:Array.isArray(lastGoodItems),
          last_good_items_at:lastGoodItemsAt,
          last_good_item_count:Array.isArray(lastGoodItems)?lastGoodItems.length:0
        }
      });
    }

    if (u.pathname === '/api/items-last-good') {
      if (Array.isArray(lastGoodItems)) {
        res.setHeader('X-SkinForge-Cache','last-good');
        return json(res,200,lastGoodItems);
      }
      return json(res,503,{error:'No successful Skinport snapshot cached yet'});
    }

    if (u.pathname === '/api/items') {
      let all;
      try {
        all = await skinportFetch('/v1/items', {tradable:'1'});
      } catch (e) {
        skinforgeDiagnostics.skinport.ok=false;
        skinforgeDiagnostics.skinport.last_error=String(e.message||e);
        if (!Array.isArray(lastGoodItems)) throw e;
        all=lastGoodItems;
        res.setHeader('X-SkinForge-Fallback','last-good');
      }
      const names = (u.searchParams.get('names') || '').split('|').filter(Boolean);
      if (!names.length) return json(res, 200, all);
      const wanted = new Set(names);
      return json(res, 200, all.filter(x => wanted.has(x.market_hash_name)));
    }



    if (u.pathname === '/api/steam-batch') {
      const raw=(u.searchParams.get('names')||'').split('|').filter(Boolean).slice(0,8);
      if(!raw.length) return json(res,400,{error:'names is required'});
      const out=[];
      for (let i=0;i<raw.length;i++){
        const name=raw[i];
        try{
          const d=await steamPrice(name);
          out.push({name,...d});
        }catch(e){
          out.push({name,error:String(e.message||e)});
        }
        if(i<raw.length-1) await sleep(650);
      }
      return json(res,200,out);
    }

    if (u.pathname === '/api/steam') {
      const name=u.searchParams.get('name');
      if(!name) return json(res,400,{error:'name is required'});
      const data=await steamPrice(name);
      return json(res,200,data);
    }

    if (u.pathname === '/api/history') {
      // Получаем общую историю одним запросом и фильтруем уже на фронтенде.
      // Это надёжнее, чем передавать сразу много market_hash_name.
      const data = await skinportFetch('/v1/sales/history');
      return json(res, 200, data);
    }

    json(res, 404, {error:'API endpoint not found'});
  } catch (err) {
    json(res, 502, {error:'Skinport request failed', detail:String(err.message || err)});
  }
}

function serveStatic(req, res, u) {
  let rel = decodeURIComponent(u.pathname);
  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT)) return send(res,403,'Forbidden','text/plain');

  fs.readFile(file, (err, buf) => {
    if (err) return send(res,404,'Not found','text/plain');
    const ext = path.extname(file).toLowerCase();
    const types = {
      '.html':'text/html; charset=utf-8',
      '.js':'application/javascript; charset=utf-8',
      '.css':'text/css; charset=utf-8',
      '.svg':'image/svg+xml',
      '.png':'image/png',
      '.jpg':'image/jpeg',
      '.jpeg':'image/jpeg',
      '.webp':'image/webp',
      '.txt':'text/plain; charset=utf-8'
    };
    send(res,200,buf,types[ext] || 'application/octet-stream');
  });
}

http.createServer(async (req,res) => {
  applySecurityHeaders(res);
  const reqStarted=Date.now();
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const u = new URL(req.url, `http://${req.headers.host}`);
  if (u.pathname.startsWith('/api/')) return api(req,res,u);
  return serveStatic(req,res,u);
}).listen(PORT, HOST, () => { log('info','SkinForge started',{url:`http://${HOST}:${PORT}`,env:NODE_ENV}); });
