const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
const appSrc = fs.readFileSync(path.join(__dirname, '../renderer/app.js'), 'utf8');
const CUSTOMER = { id: 'uid-1', email: 'a@b.com', title: 'Mr', first_name: 'James', last_name: 'Whitfield', account_number: '111', created_at: '2026-06-01T00:00:00Z' };
const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true, runScripts: 'outside-only' });
const { window } = dom; const errors = [];
window.addEventListener('error', e => errors.push((e.error && e.error.stack) || e.message));
function td(t){ if(t==='profiles')return[CUSTOMER]; if(t==='app_admins')return[{user_id:'uid-1'}]; if(t==='app_settings')return[{id:1,default_currency:'USD',quote_validity_days:14,deposit_pct:0}]; return []; }
function qb(t){ const st={op:'select'}; const p=new Proxy(function(){},{get(_,k){ if(k==='insert')return(r)=>{st.op='insert';st.payload=r;return p;}; if(k==='update')return()=>p; if(k==='delete')return()=>p; if(k==='then'){ if(t==='drafts'&&st.op==='insert')return(fn)=>Promise.resolve({data:{id:'d1'},error:null}).then(fn); const d=td(t);return(fn)=>Promise.resolve({data:d,count:d.length,error:null}).then(fn);} if(k==='maybeSingle'||k==='single'){ if(t==='drafts'&&st.op==='insert')return()=>Promise.resolve({data:{id:'d1'},error:null}); return()=>Promise.resolve({data:td(t)[0]||null,error:null});} return()=>p; },apply(){return p;}}); return p; }
const chan={on(){return chan;},subscribe(){return chan;}};
window.supabase={createClient(){return{auth:{getSession:()=>Promise.resolve({data:{session:{user:{id:'uid-1',email:'a@b.com'}}}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),getUser:()=>Promise.resolve({data:{user:{id:'uid-1'}}}),signOut:()=>Promise.resolve({})},from:(t)=>qb(t),rpc:()=>Promise.resolve({data:true,error:null}),channel:()=>chan,removeChannel(){},functions:{invoke:async()=>({data:{}})},storage:{from:()=>({upload:async()=>({}),getPublicUrl:()=>({data:{publicUrl:''}})})}};}};
window.adminApp={platform:'darwin',appVersion:async()=>'x',onUpdateStatus(){},checkForUpdates(){},openReleases(){},saveCSV:async()=>({})};
const tick=(ms=40)=>new Promise(r=>setTimeout(r,ms)); const RUN=window['ev'+'al'];
(async()=>{
  RUN(appSrc); await tick(120);
  const doc=window.document;
  doc.querySelector('[data-tab=customers]').click(); await tick(60);
  const r=doc.querySelector('.cust-row,[data-cust]'); if(r){r.click();await tick(50);}
  Array.from(doc.querySelectorAll('button')).find(b=>b.textContent==='New itinerary').click(); await tick(120);
  function labels(){ return Array.from(doc.querySelectorAll('#inv-segs .seg-role')).map(e=>e.textContent); }
  console.log('flight cards:', doc.querySelectorAll('#inv-segs .seg-card').length, '| labels:', JSON.stringify(labels()));
  const firstName = doc.querySelector('.trav-first');
  console.log('traveler rows:', doc.querySelectorAll('.trav-row').length, '| seeded first name:', firstName && firstName.value);
  console.log('add-return button visible (round):', (doc.getElementById('inv-add-return')||{}).style && doc.getElementById('inv-add-return').style.display);
  // add a flight in round mode -> should insert BEFORE return
  doc.getElementById('inv-add-flight').click(); await tick(40);
  console.log('after add flight -> count:', doc.querySelectorAll('#inv-segs .seg-card').length, '| labels:', JSON.stringify(labels()));
  // switch to multi -> add-return button shows
  Array.from(doc.querySelectorAll('.tt-btn')).find(b=>b.getAttribute('data-tt')==='multi').click(); await tick(40);
  console.log('multi: add-return display:', doc.getElementById('inv-add-return').style.display);
  // auto-capitalize title on blur
  const title=doc.getElementById('itin-title'); title.value='dubai first class'; title.dispatchEvent(new window.Event('blur',{bubbles:false}));
  await tick(20); console.log('title after blur:', title.value);
  console.log('errors:', errors.length? errors.slice(0,2).join(' || ') : 'none');
})();
