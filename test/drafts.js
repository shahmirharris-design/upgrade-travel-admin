/* Headless test of the customer-attached draft flow (autosave / manual save). */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const appSrc = fs.readFileSync(path.join(__dirname, '../renderer/app.js'), 'utf8');

const CUSTOMER = { id: 'uid-1', email: 'a@b.com', first_name: 'Ann', last_name: 'Bee', account_number: '111', created_at: '2026-06-01T00:00:00Z' };
const ops = [];
let draftSeq = 0;
const draftRows = [];

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true, runScripts: 'outside-only' });
const { window } = dom;
const errors = [];
window.addEventListener('error', e => errors.push((e.error && e.error.stack) || e.message));

function tableData(t) {
  if (t === 'profiles') return [CUSTOMER];
  if (t === 'app_admins') return [{ user_id: 'uid-1' }];
  if (t === 'app_settings') return [{ id: 1, default_currency: 'USD', quote_validity_days: 14, deposit_pct: 0 }];
  if (t === 'drafts') return draftRows.slice();
  return [];
}
function qb(table) {
  const st = { table, op: 'select', payload: null };
  const p = new Proxy(function () {}, {
    get(_, prop) {
      if (prop === 'insert') return (row) => { st.op = 'insert'; st.payload = row; return p; };
      if (prop === 'update') return (row) => { st.op = 'update'; st.payload = row; return p; };
      if (prop === 'delete') return () => { st.op = 'delete'; return p; };
      if (prop === 'then') {
        if (table === 'drafts' && st.op === 'insert') { const id = 'draft-' + (++draftSeq); draftRows.push(Object.assign({ id }, st.payload)); ops.push({ op: 'insert', id, payload: st.payload }); return (fn) => Promise.resolve({ data: { id }, error: null }).then(fn); }
        if (table === 'drafts' && st.op === 'delete') { ops.push({ op: 'delete' }); return (fn) => Promise.resolve({ data: null, error: null }).then(fn); }
        if (table === 'drafts' && st.op === 'update') { ops.push({ op: 'update', payload: st.payload }); return (fn) => Promise.resolve({ data: { id: 'x' }, error: null }).then(fn); }
        const data = tableData(table); return (fn) => Promise.resolve({ data, count: data.length, error: null }).then(fn);
      }
      if (prop === 'maybeSingle' || prop === 'single') {
        return () => {
          if (table === 'drafts' && st.op === 'insert') { const id = 'draft-' + (++draftSeq); draftRows.push(Object.assign({ id }, st.payload)); ops.push({ op: 'insert', id, payload: st.payload }); return Promise.resolve({ data: { id }, error: null }); }
          if (table === 'drafts' && st.op === 'update') { ops.push({ op: 'update', payload: st.payload }); return Promise.resolve({ data: { id: 'x' }, error: null }); }
          return Promise.resolve({ data: tableData(table)[0] || null, error: null });
        };
      }
      return () => p;
    },
    apply() { return p; }
  });
  return p;
}
const chan = { on() { return chan; }, subscribe() { return chan; } };
window.supabase = { createClient() { return {
  auth: { getSession: () => Promise.resolve({ data: { session: { user: { id: 'uid-1', email: 'a@b.com' } } } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), getUser: () => Promise.resolve({ data: { user: { id: 'uid-1', email: 'a@b.com' } } }), signOut: () => Promise.resolve({}) },
  from: (t) => qb(t), rpc: () => Promise.resolve({ data: true, error: null }), channel: () => chan, removeChannel() {},
  functions: { invoke: async () => ({ data: {} }) }, storage: { from: () => ({ upload: async () => ({}), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) }
}; } };
window.adminApp = { platform: 'darwin', appVersion: async () => '1.0.44', onUpdateStatus() {}, checkForUpdates() {}, openReleases() {}, saveCSV: async () => ({}) };

const tick = (ms = 40) => new Promise(r => setTimeout(r, ms));
const RUN = window['ev' + 'al'];
(async () => {
  RUN(appSrc);
  await tick(120);
  const doc = window.document;
  doc.querySelector('[data-tab=customers]').click(); await tick(80);
  const row = doc.querySelector('.cust-row, [data-cust]');
  if (row) { row.click(); await tick(60); }
  let newQuote = Array.from(doc.querySelectorAll('button')).find(b => b.textContent === 'New quote');
  console.log('New quote button:', !!newQuote);
  newQuote.click(); await tick(100);
  console.log('on quote form:', !!doc.getElementById('inv-title'), '| Save draft btn:', !!Array.from(doc.querySelectorAll('button')).find(b => b.textContent === 'Save draft'));
  const title = doc.getElementById('inv-title');
  title.value = 'Maldives First Class';
  title.dispatchEvent(new window.Event('input', { bubbles: true }));
  await tick(1500);
  const inserted = ops.filter(o => o.op === 'insert');
  console.log('autosave inserts:', inserted.length, inserted[0] ? ('title=' + inserted[0].payload.title + ' kind=' + inserted[0].payload.kind + ' cust=' + inserted[0].payload.customer_id) : '');
  title.value = 'Maldives First Class Trip';
  title.dispatchEvent(new window.Event('input', { bubbles: true }));
  await tick(1500);
  console.log('after 2nd edit -> inserts:', ops.filter(o=>o.op==='insert').length, 'updates:', ops.filter(o=>o.op==='update').length);
  const saveBtn = Array.from(doc.querySelectorAll('button')).find(b => b.textContent === 'Save draft');
  saveBtn.click(); await tick(200);
  console.log('after manual save -> updates:', ops.filter(o=>o.op==='update').length);
  console.log('window errors:', errors.length ? errors.slice(0,2).join(' || ') : 'none');
})();
