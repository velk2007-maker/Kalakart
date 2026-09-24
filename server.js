const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function loadDotEnv() {
  const envFile = path.join(__dirname, '.env');
  if (!fs.existsSync(envFile)) return;
  for (const raw of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if ((value.startsWith('\"') && value.endsWith('\"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}
loadDotEnv();

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5.6-luna';

function loadDB() {
  if (!fs.existsSync(DB_FILE)) return {users:[],products:[],orders:[],sessions:[],messages:[]};
  try { const data=JSON.parse(fs.readFileSync(DB_FILE,'utf8')); if(!Array.isArray(data.messages)) data.messages=[]; return data; } catch { return {users:[],products:[],orders:[],sessions:[],messages:[]}; }
}
function saveDB(db) { fs.mkdirSync(DATA_DIR,{recursive:true}); fs.writeFileSync(DB_FILE, JSON.stringify(db,null,2)); }
let db=loadDB();

const DEFAULT_ARTISAN_ID = 'usr_kalakart_catalog';
const DEFAULT_PRODUCTS = [
  {
    id:'prd_catalog_terracotta', owner_id:DEFAULT_ARTISAN_ID, title:'Hand-painted Terracotta Diyas',
    description:'Traditional terracotta diyas hand-finished with simple painted details. A warm handmade accent for festive and everyday spaces.',
    category:'Decor', tags:['terracotta','diya','handmade','festive','home decor'], price:349, stock:18,
    image_url:'https://images.unsplash.com/photo-1603006905003-be475563bc59?auto=format&fit=crop&w=900&q=80',
    materials:'Terracotta clay', voice_transcript:'', created_at:'2026-09-01T09:00:00.000Z', is_default:true
  },
  {
    id:'prd_catalog_handloom', owner_id:DEFAULT_ARTISAN_ID, title:'Handloom Cotton Saree',
    description:'Lightweight handloom cotton saree with a simple woven border, designed for comfortable everyday wear.',
    category:'Textiles', tags:['handloom','cotton','saree','weaving','textile'], price:1890, stock:9,
    image_url:'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=900&q=80',
    materials:'Cotton', voice_transcript:'', created_at:'2026-09-02T09:00:00.000Z', is_default:true
  },
  {
    id:'prd_catalog_brass', owner_id:DEFAULT_ARTISAN_ID, title:'Brass Leaf Diya',
    description:'Handcrafted brass diya with a leaf-inspired form, suitable for a small prayer space or as a decorative accent.',
    category:'Home', tags:['brass','diya','metal craft','pooja','decor'], price:725, stock:12,
    image_url:'https://images.unsplash.com/photo-1603899122634-f086ca5f5ddd?auto=format&fit=crop&w=900&q=80',
    materials:'Brass', voice_transcript:'', created_at:'2026-09-03T09:00:00.000Z', is_default:true
  },
  {
    id:'prd_catalog_kalamkari', owner_id:DEFAULT_ARTISAN_ID, title:'Kalamkari Hand-painted Dupatta',
    description:'Hand-painted textile inspired by traditional Kalamkari motifs, with a soft drape for everyday styling.',
    category:'Fashion', tags:['kalamkari','dupatta','hand-painted','textile','artisan'], price:1290, stock:7,
    image_url:'https://images.unsplash.com/photo-1610189012906-4c9b9a9d2e55?auto=format&fit=crop&w=900&q=80',
    materials:'Cotton textile', voice_transcript:'', created_at:'2026-09-04T09:00:00.000Z', is_default:true
  }
];
function ensureDefaultCatalog() {
  if (!db.users.some(u=>u.id===DEFAULT_ARTISAN_ID)) {
    db.users.push({
      id:DEFAULT_ARTISAN_ID, name:'Kalakart Catalog', email:'catalog@kalakart.local', role:'artisan',
      password_hash:'', salt:'', created_at:'2026-09-01T08:00:00.000Z', is_system:true
    });
  }
  const existing=new Set(db.products.map(p=>p.id));
  let changed=false;
  for(const product of DEFAULT_PRODUCTS) if(!existing.has(product.id)){ db.products.push(product); changed=true; }
  if(changed || !fs.existsSync(DB_FILE)) saveDB(db);
}
ensureDefaultCatalog();

function id(prefix) { return prefix+'_'+crypto.randomBytes(8).toString('hex'); }
function hashPassword(password,salt) { return crypto.scryptSync(password,salt,64).toString('hex'); }
function makePassword(password) { const salt=crypto.randomBytes(16).toString('hex'); return {salt,hash:hashPassword(password,salt)}; }
function verifyPassword(password,u) { try{return crypto.timingSafeEqual(Buffer.from(hashPassword(password,u.salt),'hex'),Buffer.from(u.password_hash,'hex'));}catch{return false;} }
function json(res,status,data){const out=JSON.stringify(data);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(out);}
function readBody(req){return new Promise((resolve,reject)=>{let s='';req.on('data',c=>{s+=c;if(s.length>18*1024*1024){reject(new Error('Request too large'));req.destroy();}});req.on('end',()=>{try{resolve(s?JSON.parse(s):{})}catch(e){reject(new Error('Invalid JSON'))}});req.on('error',reject);});}
function bearer(req){const h=req.headers.authorization||'';return h.startsWith('Bearer ')?h.slice(7):'';}
function auth(req){const token=bearer(req);const s=db.sessions.find(x=>x.token===token);if(!s)return null;return db.users.find(u=>u.id===s.user_id)||null;}
function safeUser(u){return {id:u.id,name:u.name,email:u.email,role:u.role,created_at:u.created_at};}
function requireUser(req,res,role){const u=auth(req);if(!u){json(res,401,{error:'Please sign in.'});return null;}if(role&&u.role!==role){json(res,403,{error:'This action is not available for your account role.'});return null;}return u;}
function parsePrice(v){const n=Number(v);return Number.isFinite(n)&&n>=0?n:0;}
function productView(p){
  const owner=db.users.find(u=>u.id===p.owner_id);
  return {...p, short:p.title, alt:p.title, image:p.image_url || null, artisan:owner?.name || 'Kalakart artisan', location:'India', badge:p.is_default?'Featured craft':'Handmade', about:p.description || 'Handmade product listed by the artisan.', aboutMore:''};
}

async function openai(prompt, imageDataUrl=null) {
  if(!OPENAI_API_KEY) throw new Error('AI is not configured. Add OPENAI_API_KEY to .env and restart the server.');
  const content=[{type:'input_text',text:prompt}];
  if(imageDataUrl) content.push({type:'input_image',image_url:imageDataUrl});
  const payload={model:OPENAI_MODEL,input:[{role:'user',content}]};
  const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Authorization':'Bearer '+OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const d=await r.json();
  if(!r.ok) throw new Error(d.error?.message||'AI provider request failed');
  const text=d.output_text || (d.output||[]).flatMap(x=>x.content||[]).map(x=>x.text||'').join(' ').trim();
  if(!text) throw new Error('AI provider returned no text');
  return text;
}
function jsonFromAI(text){
  const clean=text.replace(/^```json\s*/i,'').replace(/^```\s*/,'').replace(/```\s*$/,'').trim();
  try{return JSON.parse(clean);}catch{}
  const m=clean.match(/\{[\s\S]*\}/); if(m) try{return JSON.parse(m[0])}catch{}
  throw new Error('AI returned an invalid structured response.');
}

function analyticsFor(user) {
  const ownProducts=db.products.filter(p=>p.owner_id===user.id);
  const ownOrders=db.orders.filter(o=>o.artisan_id===user.id);
  const buyers=new Set(ownOrders.map(o=>o.buyer_id));
  const revenue=ownOrders.reduce((s,o)=>s+Number(o.total||0),0);
  const categoryMap={};
  for(const o of ownOrders){
    const p=db.products.find(x=>x.id===o.product_id); const c=p?.category||'Other';
    categoryMap[c]=(categoryMap[c]||0)+1;
  }
  const marketMap={};
  for(const o of db.orders){
    const p=db.products.find(x=>x.id===o.product_id); if(!p)continue;
    marketMap[p.category]=(marketMap[p.category]||0)+1;
  }
  const topCategories=Object.entries(marketMap).sort((a,b)=>b[1]-a[1]).map(([category,orders])=>({category,orders}));
  return {
    personal:{products:ownProducts.length,orders:ownOrders.length,buyers:buyers.size,revenue},
    marketplace:{hasData:db.orders.length>0,topCategories,marketplaceOrders:db.orders.length,marketplaceProducts:db.products.length}
  };
}

function serveStatic(req,res){
  let p=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(p==='/')p='/index.html';
  const file=path.normalize(path.join(PUBLIC,p));
  if(!file.startsWith(PUBLIC)){res.writeHead(403);return res.end('Forbidden');}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);return res.end('Not found')}const ext=path.extname(file);const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.css':'text/css'};res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream'});res.end(data);});
}

async function api(req,res) {
  const u=new URL(req.url,'http://localhost'); const p=u.pathname;
  try {
    if(p==='/api/health') return json(res,200,{ok:true,aiConfigured:Boolean(OPENAI_API_KEY)});
    if(p==='/api/auth/register' && req.method==='POST'){
      const b=await readBody(req); const name=String(b.name||'').trim(),email=String(b.email||'').trim().toLowerCase(),password=String(b.password||''),role=b.role==='buyer'?'buyer':'artisan';
      if(name.length<2)return json(res,400,{error:'Please enter your name.'});
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return json(res,400,{error:'Enter a valid email address.'});
      if(password.length<8)return json(res,400,{error:'Password must be at least 8 characters.'});
      if(db.users.some(x=>x.email===email))return json(res,409,{error:'An account with this email already exists.'});
      const pw=makePassword(password);const user={id:id('usr'),name,email,role,...{password_hash:pw.hash,salt:pw.salt},created_at:new Date().toISOString()};
      db.users.push(user);const token=crypto.randomBytes(32).toString('hex');db.sessions.push({token,user_id:user.id,created_at:new Date().toISOString()});saveDB(db);
      return json(res,201,{token,user:safeUser(user)});
    }
    if(p==='/api/auth/login' && req.method==='POST'){
      const b=await readBody(req);const email=String(b.email||'').trim().toLowerCase();const user=db.users.find(x=>x.email===email);
      if(!user||!verifyPassword(String(b.password||''),user)|| (b.role && b.role!==user.role)) return json(res,401,{error:'Email, password, or account type is incorrect.'});
      const token=crypto.randomBytes(32).toString('hex');db.sessions=db.sessions.filter(s=>s.user_id!==user.id);db.sessions.push({token,user_id:user.id,created_at:new Date().toISOString()});saveDB(db);
      return json(res,200,{token,user:safeUser(user)});
    }
    if(p==='/api/auth/logout' && req.method==='POST'){const token=bearer(req);db.sessions=db.sessions.filter(s=>s.token!==token);saveDB(db);return json(res,200,{ok:true});}
    if(p==='/api/me'){const user=requireUser(req,res);if(!user)return;return json(res,200,{user:safeUser(user)});}
    if(p==='/api/products' && req.method==='GET'){
      const user=auth(req);const mine=u.searchParams.get('mine')==='true';
      let list=db.products;
      if(mine){if(!user)return json(res,401,{error:'Please sign in.'});list=list.filter(x=>x.owner_id===user.id);}
      return json(res,200,{products:list.map(productView)});
    }
    if(p==='/api/products' && req.method==='POST'){
      const user=requireUser(req,res,'artisan');if(!user)return;const b=await readBody(req);
      const product={id:id('prd'),owner_id:user.id,title:String(b.title||'').trim(),description:String(b.description||'').trim(),category:String(b.category||'Home'),tags:Array.isArray(b.tags)?b.tags.slice(0,20):[],price:parsePrice(b.price),stock:Math.max(0,Number(b.stock||0)),image_url:b.image_url||null,materials:String(b.materials||''),voice_transcript:String(b.voice_transcript||''),created_at:new Date().toISOString()};
      if(!product.title)return json(res,400,{error:'Product title is required.'}); if(product.price<=0)return json(res,400,{error:'Product price must be greater than 0.'});
      db.products.push(product);saveDB(db);return json(res,201,{product});
    }
    if(p==='/api/orders' && req.method==='GET'){
      const user=requireUser(req,res);if(!user)return;let list=user.role==='artisan'?db.orders.filter(o=>o.artisan_id===user.id):db.orders.filter(o=>o.buyer_id===user.id);
      return json(res,200,{orders:list.sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))});
    }
    if(p==='/api/orders' && req.method==='POST'){
      const user=requireUser(req,res,'buyer');if(!user)return;const b=await readBody(req);const product=db.products.find(x=>x.id===b.product_id);
      if(!product)return json(res,404,{error:'Product not found.'});if(product.stock<=0)return json(res,409,{error:'This product is out of stock.'});
      const delivery=95,total=Number(product.price)+delivery;const order={id:'KK-'+String(Math.floor(100000+Math.random()*899999)),buyer_id:user.id,artisan_id:product.owner_id,product_id:product.id,product_title:product.title,price:Number(product.price),delivery,total,status:'Pending',created_at:new Date().toISOString()};
      product.stock-=1;db.orders.push(order);saveDB(db);return json(res,201,{order});
    }
    if(p==='/api/messages' && req.method==='GET'){
      const user=requireUser(req,res);if(!user)return;
      const otherId=u.searchParams.get('user_id');
      let list=db.messages.filter(m=>m.sender_id===user.id || m.recipient_id===user.id);
      if(otherId) list=list.filter(m=>(m.sender_id===user.id && m.recipient_id===otherId)||(m.sender_id===otherId && m.recipient_id===user.id));
      list.sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
      for(const m of list){
        if(m.recipient_id===user.id) m.read_at=m.read_at||new Date().toISOString();
      }
      saveDB(db);
      const messages=list.map(m=>{
        const sender=db.users.find(x=>x.id===m.sender_id), recipient=db.users.find(x=>x.id===m.recipient_id);
        const product=m.product_id?db.products.find(x=>x.id===m.product_id):null;
        return {...m,sender:safeUser(sender),recipient:safeUser(recipient),counterparty_id:m.sender_id===user.id?m.recipient_id:m.sender_id,counterparty_name:(m.sender_id===user.id?recipient:sender)?.name||'User',product_title:product?.title||null};
      });
      return json(res,200,{messages,unread:db.messages.filter(m=>m.recipient_id===user.id&&!m.read_at).length});
    }
    if(p==='/api/messages' && req.method==='POST'){
      const user=requireUser(req,res);if(!user)return;const b=await readBody(req);
      const recipientId=String(b.recipient_id||'').trim(), text=String(b.text||'').trim();
      const recipient=db.users.find(x=>x.id===recipientId);
      if(!recipient)return json(res,404,{error:'Recipient not found.'});
      if(recipient.id===user.id)return json(res,400,{error:'You cannot message yourself.'});
      if(!text)return json(res,400,{error:'Message cannot be empty.'});
      if(text.length>2000)return json(res,400,{error:'Message is too long.'});
      let product=null, order=null;
      if(b.product_id){ product=db.products.find(x=>x.id===String(b.product_id)); if(!product)return json(res,404,{error:'Product not found.'}); }
      if(b.order_id){ order=db.orders.find(x=>x.id===String(b.order_id)); if(!order)return json(res,404,{error:'Order not found.'}); }
      const prior=db.messages.some(m=>(m.sender_id===user.id&&m.recipient_id===recipient.id)||(m.sender_id===recipient.id&&m.recipient_id===user.id));
      const buyer=user.role==='buyer'?user:recipient.role==='buyer'?recipient:null;
      const artisan=user.role==='artisan'?user:recipient.role==='artisan'?recipient:null;
      if(!buyer||!artisan)return json(res,400,{error:'Messages are available between buyers and artisans.'});
      if(product && product.owner_id!==artisan.id)return json(res,403,{error:'The selected product does not belong to this artisan.'});
      if(order && !(order.buyer_id===buyer.id && order.artisan_id===artisan.id))return json(res,403,{error:'The selected order is not linked to this conversation.'});
      if(user.role==='artisan' && !prior && !order)return json(res,403,{error:'An artisan can reply to a buyer after the buyer starts the conversation.'});
      if(user.role==='buyer' && product && product.owner_id!==artisan.id)return json(res,403,{error:'The selected product does not belong to this artisan.'});
      const message={id:id('msg'),sender_id:user.id,recipient_id:recipient.id,product_id:product?.id||order?.product_id||null,order_id:order?.id||null,text,created_at:new Date().toISOString(),read_at:null};
      db.messages.push(message);saveDB(db);
      return json(res,201,{message});
    }
    if(p==='/api/analytics'){
      const user=requireUser(req,res,'artisan');if(!user)return;return json(res,200,analyticsFor(user));
    }
    if(p==='/api/ai/identify' && req.method==='POST'){
      const user=requireUser(req,res,'artisan');if(!user)return;const b=await readBody(req);
      const text=await openai('Identify the handmade craft/product in this image for an artisan marketplace. Return a concise description of what is visibly identifiable, likely craft category, likely materials only when visually supportable, and 5 useful search tags. Do not invent origin, maker, measurements, or materials that cannot be inferred from the image.',b.image);
      return json(res,200,{result:text});
    }
    if(p==='/api/ai/listing' && req.method==='POST'){
      const user=requireUser(req,res,'artisan');if(!user)return;const b=await readBody(req);
      const prompt=`Create a marketplace listing for a marginalized artisan. Use the artisan's spoken notes and image observation. Do not invent facts. If a detail is not provided or visible, omit it. Return ONLY valid JSON with keys title, description, category, materials, tags, price. price should be 0 unless the artisan supplied a price. Spoken notes: ${b.transcript||'(none)'}\nImage analysis note: ${b.vision||'(none)'}\nCategories allowed: Home, Kitchen, Decor, Textiles, Fashion, Art.`;
      const out=jsonFromAI(await openai(prompt,b.image||null));out.tags=Array.isArray(out.tags)?out.tags.slice(0,10):[];return json(res,200,out);
    }
    if(p==='/api/ai/assistant' && req.method==='POST'){
      const user=requireUser(req,res);if(!user)return;const b=await readBody(req);const a=analyticsFor(user);
      const ownProducts=db.products.filter(x=>x.owner_id===user.id).map(x=>({id:x.id,title:x.title,category:x.category,price:x.price,stock:x.stock}));
      const ownOrders=db.orders.filter(x=>x.artisan_id===user.id).map(x=>({id:x.id,product_title:x.product_title,total:x.total,status:x.status,created_at:x.created_at}));
      const context=JSON.stringify({user:{name:user.name,role:user.role},analytics:a,products:ownProducts,orders:ownOrders});
      const answer=await openai(`You are the Kalakart dashboard assistant. Answer the user's question using ONLY the supplied Kalakart database context. Never invent a statistic. If the context lacks the requested information, say so. Keep answers concise and useful. Database context: ${context}\nUser question: ${String(b.question||'')}`);
      return json(res,200,{answer});
    }
    return json(res,404,{error:'API route not found'});
  } catch(e) { console.error(e); return json(res,500,{error:e.message||'Server error'}); }
}

const server=http.createServer((req,res)=>{if(req.url.startsWith('/api/'))api(req,res);else serveStatic(req,res);});
server.listen(PORT,HOST,()=>console.log(`Kalakart running at http://${HOST}:${PORT}`));
