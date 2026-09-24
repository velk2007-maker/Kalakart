const http=require('http'),{spawn}=require('child_process'),fs=require('fs');
const port=3012; const dir=require('path').join(__dirname,'..');
try{fs.unlinkSync(dir+'/data/db.json')}catch{}
const child=spawn(process.execPath,[dir+'/server.js'],{cwd:dir,env:{...process.env,PORT:String(port),HOST:'127.0.0.1'},stdio:'ignore'});
const base='http://127.0.0.1:'+port; const wait=ms=>new Promise(r=>setTimeout(r,ms));
function call(path,method='GET',body,token){return new Promise((resolve,reject)=>{const data=body?JSON.stringify(body):null;const req=http.request(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})}},r=>{let s='';r.on('data',c=>s+=c);r.on('end',()=>{let j={};try{j=JSON.parse(s)}catch{};if(r.statusCode>=400)return reject(new Error(r.statusCode+' '+(j.error||s)));resolve(j)})});req.on('error',reject);if(data)req.write(data);req.end()})}
(async()=>{try{await wait(400);
 const a=await call('/api/auth/register','POST',{name:'Verify Artisan',email:'verify-artisan@example.com',password:'password123',role:'artisan'});
 const b=await call('/api/auth/register','POST',{name:'Verify Buyer',email:'verify-buyer@example.com',password:'password123',role:'buyer'});
 const p=await call('/api/products','POST',{title:'Verify Bowl',description:'Handmade bowl',category:'Kitchen',tags:['clay'],price:500,stock:2},a.token);
 const before=await call('/api/analytics','GET',null,a.token);
 const o=await call('/api/orders','POST',{product_id:p.product.id},b.token);
 const after=await call('/api/analytics','GET',null,a.token);
 if(before.personal.products!==1||before.personal.orders!==0||after.personal.orders!==1||after.personal.buyers!==1||after.personal.revenue!==595) throw new Error('Linkage/analytics assertion failed');
 console.log('PASS: auth, product ownership, buyer order linkage, analytics'); process.exitCode=0;
}catch(e){console.error('FAIL:',e.message);process.exitCode=1}finally{child.kill();try{fs.unlinkSync(dir+'/data/db.json')}catch{}}})();