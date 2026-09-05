const http=require('http');
const crypto=require('crypto');
const {Pool}=require('pg');

const DATABASE_URL=process.env.DATABASE_URL||'';
const SESSION_SECRET=process.env.SESSION_SECRET||'skinforge-dev-change-me';
let db=null,dbReady=null;

function hmac(v){return crypto.createHmac('sha256',SESSION_SECRET).update(String(v)).digest('hex')}
function eq(a,b){const A=Buffer.from(String(a||'')),B=Buffer.from(String(b||''));return A.length===B.length&&crypto.timingSafeEqual(A,B)}
function cookies(req){return Object.fromEntries(String(req.headers.cookie||'').split(';').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf('=');return[decodeURIComponent(i<0?x:x.slice(0,i)),decodeURIComponent(i<0?'':x.slice(i+1))]}))}
function steamId(req){const x=cookies(req).sf_session||'',i=x.lastIndexOf('.');if(i<1)return null;const id=x.slice(0,i),sig=x.slice(i+1);return /^\d{17}$/.test(id)&&eq(sig,hmac('session:'+id))?id:null}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
async function body(req){return await new Promise((resolve,reject)=>{let n=0,c=[];req.on('data',x=>{n+=x.length;if(n>1024*1024){reject(Error('Body too large'));req.destroy();return}c.push(x)});req.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(c).toString('utf8')||'{}'))}catch(e){reject(Error('Invalid JSON'))}});req.on('error',reject)})}
async function ensureDb(){
  if(dbReady)return dbReady;
  dbReady=(async()=>{
    if(!DATABASE_URL)throw Error('DATABASE_URL missing');
    if(!db)db=new Pool({connectionString:DATABASE_URL,max:5,idleTimeoutMillis:30000,connectionTimeoutMillis:10000});
    await db.query(`CREATE TABLE IF NOT EXISTS support_tickets(
      id BIGSERIAL PRIMARY KEY,
      steamid TEXT NOT NULL,
      category TEXT,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      reply TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await db.query('CREATE INDEX IF NOT EXISTS support_tickets_steamid_created_idx ON support_tickets(steamid,created_at DESC)');
    return true;
  })().catch(e=>{dbReady=null;throw e});
  return dbReady;
}
async function supportApi(req,res){
  const id=steamId(req);
  if(!id)return json(res,401,{error:'Steam login required'});
  try{
    await ensureDb();
    if(req.method==='GET'){
      const r=await db.query('SELECT id,category,subject,message,status,reply,created_at,updated_at FROM support_tickets WHERE steamid=$1 ORDER BY created_at DESC LIMIT 100',[id]);
      return json(res,200,{ok:true,tickets:r.rows});
    }
    if(req.method==='POST'){
      const b=await body(req);
      const allowed=new Set(['bug','account','prices','idea','other']);
      const category=allowed.has(String(b.category||''))?String(b.category):'other';
      const subject=String(b.subject||'').trim();
      const message=String(b.message||'').trim();
      if(subject.length<3||subject.length>120)return json(res,400,{error:'Тема должна быть от 3 до 120 символов'});
      if(message.length<10||message.length>5000)return json(res,400,{error:'Сообщение должно быть от 10 до 5000 символов'});
      const rate=await db.query("SELECT COUNT(*)::int AS count FROM support_tickets WHERE steamid=$1 AND created_at >= NOW() - INTERVAL '1 hour'",[id]);
      if(Number(rate.rows[0]?.count||0)>=5)return json(res,429,{error:'Слишком много обращений. Максимум 5 в час.'});
      const r=await db.query('INSERT INTO support_tickets(steamid,category,subject,message) VALUES($1,$2,$3,$4) RETURNING id,category,subject,message,status,reply,created_at,updated_at',[id,category,subject,message]);
      return json(res,201,{ok:true,ticket:r.rows[0]});
    }
    return json(res,405,{error:'Method not allowed'});
  }catch(e){
    console.error(JSON.stringify({level:'error',message:'Support API error',error:String(e.message||e)}));
    return json(res,500,{error:'Не удалось обработать обращение'});
  }
}

const originalCreateServer=http.createServer.bind(http);
http.createServer=function(listener){
  return originalCreateServer(async(req,res)=>{
    try{
      const u=new URL(req.url,`http://${req.headers.host||'localhost'}`);
      if(u.pathname==='/api/support/tickets')return supportApi(req,res);

      const originalEnd=res.end.bind(res);
      res.end=function(chunk,encoding,cb){
        try{
          const ct=String(res.getHeader('Content-Type')||'');
          if(chunk&&(ct.includes('text/html')||ct.includes('application/json'))){
            let text=Buffer.isBuffer(chunk)?chunk.toString('utf8'):String(chunk);
            text=text.replace(/SkinForge v16\.1/g,'SkinForge v16.2');
            if(ct.includes('text/html')&&!text.includes('href="support.html"')&&!text.includes("href='support.html'")){
              text=text.replace(/<\/nav>/i,'<a href="support.html">Поддержка</a></nav>');
            }
            chunk=text;
          }
        }catch(e){}
        return originalEnd(chunk,encoding,cb);
      };
      return listener(req,res);
    }catch(e){
      return listener(req,res);
    }
  });
};

ensureDb().then(()=>console.log(JSON.stringify({level:'info',message:'Support database ready'}))).catch(e=>console.error(JSON.stringify({level:'error',message:'Support database unavailable',error:String(e.message||e)})));
require('./server-v16.js');
