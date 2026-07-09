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
  Array.from(doc.querySelectorAll('button')).find(b=>b.textContent==='New quote').click(); await tick(120);
  console.log('quote: package sections present:', !!doc.getElementById('itin-hotels'), !!doc.getElementById('itin-transport'), !!doc.getElementById('itin-dining'), !!doc.getElementById('itin-ent'), !!doc.getElementById('itin-cruises'));
  // add a hotel in QUOTE mode -> should have name but NOT confirmation-no / conf-photo
  Array.from(doc.querySelectorAll('#itin-hotels ~ * button, button')).find(b=>b.textContent==='+ Add hotel').click(); await tick(40);
  const hc = doc.querySelector('#itin-hotels .itin-card');
  console.log('quote hotel card: has name:', !!(hc&&hc.querySelector('.h-name')), '| has confirmation-no (should be false):', !!(hc&&hc.querySelector('.h-conf')), '| has conf-photo (should be false):', !!(hc&&hc.querySelector('.e-conf-img')));
  // add a transport -> driver/plate/conf hidden, car kept
  Array.from(doc.querySelectorAll('button')).find(b=>b.textContent==='+ Add transport').click(); await tick(40);
  const tc = doc.querySelector('#itin-transport .itin-card');
  console.log('quote transport card: has car:', !!(tc&&tc.querySelector('.t-car')), '| has driver (false):', !!(tc&&tc.querySelector('.t-driver')), '| has plate (false):', !!(tc&&tc.querySelector('.t-conf')));
  // now an ITINERARY hotel card SHOULD have confirmation fields
  doc.querySelector('[data-tab=customers]').click(); await tick(60);
  const r2=doc.querySelector('.cust-row,[data-cust]'); if(r2){r2.click();await tick(50);}
  Array.from(doc.querySelectorAll('button')).find(b=>b.textContent==='New itinerary').click(); await tick(120);
  Array.from(doc.querySelectorAll('button')).find(b=>b.textContent==='+ Add hotel').click(); await tick(40);
  const ihc = doc.querySelector('#itin-hotels .itin-card');
  console.log('itinerary hotel card: has confirmation-no (should be true):', !!(ihc&&ihc.querySelector('.h-conf')), '| has conf-photo (should be true):', !!(ihc&&ihc.querySelector('.e-conf-img')));
  console.log('errors:', errors.length? errors.slice(0,3).join(' || ') : 'none');
})();
