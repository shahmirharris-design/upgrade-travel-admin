const fs = require('fs');
const { JSDOM } = require('jsdom');
const appSrc = fs.readFileSync(require('path').join(__dirname, '../renderer/app.js'), 'utf8');
const ITIN = JSON.parse(fs.readFileSync(require('path').join(__dirname, 'itin-fixture.json'), 'utf8'));
const CUSTOMER = { id: 'uid-1', email: 'shahmirharris@gmail.com', first_name: 'Shahmir', last_name: 'Harris', account_number: '47810579', created_at: '2026-06-01T00:00:00Z' };

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', { url: 'http://localhost/', pretendToBeVisual: true, runScripts: 'outside-only' });
const { window } = dom;
const errors = [];
window.addEventListener('error', e => errors.push('window.onerror: ' + ((e.error && e.error.stack) || e.message)));

function fixture(table) {
  if (table === 'profiles') return [CUSTOMER];
  if (table === 'itineraries') return [ITIN];
  if (table === 'app_admins') return [{ user_id: 'uid-1' }];
  if (table === 'app_settings') return [{ id: 1, agency_name: 'Upgrade Travel', default_currency: 'USD', quote_validity_days: 14, deposit_pct: 0 }];
  return [];
}
function qb(table) {
  const p = new Proxy(function () {}, {
    get(_, prop) {
      if (prop === 'then') {
        const data = fixture(table);
        const res = { data, count: data.length, error: null };
        return (fn, rej) => Promise.resolve(res).then(fn, rej);
      }
      if (prop === 'maybeSingle' || prop === 'single') return () => Promise.resolve({ data: fixture(table)[0] || null, error: null });
      return () => p;
    },
    apply() { return p; }
  });
  return p;
}
const chan = { on() { return chan; }, subscribe() { return chan; } };
window.supabase = { createClient() { return {
  auth: {
    getSession: () => Promise.resolve({ data: { session: { user: { id: 'uid-1', email: 'shahmirharris@gmail.com' } } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    getUser: () => Promise.resolve({ data: { user: { id: 'uid-1', email: 'shahmirharris@gmail.com' } } }),
    signOut: () => Promise.resolve({})
  },
  from: (t) => qb(t),
  rpc: () => Promise.resolve({ data: true, error: null }),
  channel: () => chan,
  removeChannel() {},
  functions: { invoke: async () => ({ data: {} }) },
  storage: { from: () => ({ upload: async () => ({}), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) }
}; } };
window.adminApp = { platform: 'darwin', appVersion: async () => '1.0.41', onUpdateStatus() {}, checkForUpdates() {}, openReleases() {}, saveCSV: async () => ({}) };

const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));
(async () => {
  const origRemove = window.Node.prototype.removeChild;
  window.Node.prototype.removeChild = function (child) { try { return origRemove.call(this, child); } catch (e) { console.log('REMOVECHILD FAIL:'); console.log(new Error().stack.split('\n').slice(2, 9).join('\n')); throw e; } };
  const origInsert = window.Node.prototype.insertBefore;
  window.Node.prototype.insertBefore = function (n, ref) { try { return origInsert.call(this, n, ref); } catch (e) { console.log('INSERTBEFORE FAIL:'); console.log(new Error().stack.split('\n').slice(2, 9).join('\n')); throw e; } };
  try { window.eval(appSrc); } catch (e) { console.log('BOOT EVAL THREW:', e.message); return; }
  await tick(80); await tick(80);
  const doc = window.document;
  const nav = doc.querySelector('[data-tab=itineraries]');
  console.log('nav itineraries found:', !!nav, '| sidebar buttons:', doc.querySelectorAll('.side-nav button').length);
  if (!nav) { console.log('BODY SNAPSHOT:', doc.body.textContent.slice(0, 300)); return; }
  nav.click(); await tick(60);
  console.log('after nav click, head:', (doc.querySelector('.main-title') || {}).textContent);
  // go to the sent list
  const viewAll = Array.from(doc.querySelectorAll('button')).find(b => b.textContent === 'View all');
  console.log('View all found:', !!viewAll);
  viewAll.click(); await tick(120);
  console.log('list head:', (doc.querySelector('.main-title') || {}).textContent, '| rows:', doc.querySelectorAll('.sq-card').length);
  const dup = Array.from(doc.querySelectorAll('button')).find(b => b.textContent === 'Duplicate');
  console.log('Duplicate button found:', !!dup);
  try {
    dup.click();
  } catch (e) { console.log('CLICK THREW SYNC:\n' + (e.stack || e.message)); }
  await tick(120);
  console.log('after Duplicate, head:', (doc.querySelector('.main-title') || {}).textContent);
  console.log('form present:', !!doc.querySelector('.inv-form'), '| title input value:', (doc.getElementById('itin-title') || {}).value);
  console.log('window errors:', errors.length ? errors.join(' || ') : 'none');
} )();
