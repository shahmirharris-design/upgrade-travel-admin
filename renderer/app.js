'use strict';
/* Upgrade Travel — Admin renderer. Talks to the same Supabase as the website.
   Admin signs in with their own account; RLS (is_admin) grants read of all customers
   and write of bookings. Only the public key ships in this app. Safe DOM only (no innerHTML). */
(function () {
  var SB_URL = 'https://kwmgqbezjghsdbucdyhj.supabase.co';
  var SB_KEY = 'sb_publishable_eHRapYduMpqayRpKNsO3FQ_gfQ9ljXv';

  var appEl = document.getElementById('app');
  if (!window.supabase || !window.supabase.createClient) {
    appEl.textContent = 'Could not load the account service. Check your internet connection and reopen the app.';
    return;
  }
  var sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  var state = { tab: 'dashboard', adminEmail: '', adminProfile: null, customers: [], selectedId: null, query: '', docCustomer: null, docFlash: null, docDraft: null, docView: 'form', docKind: null, itinDraft: null, itinView: 'form', itinFlash: null, builderTab: null, templates: null, settings: null, settingsFlash: null, custEditing: null, repRange: 'all', tasks: null, tripFilter: 'all', trips: null, gt: null, gtBuilding: false, gtFlash: null };

  /* ---------- safe DOM ---------- */
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k]; if (v == null || v === false) return;
      if (k === 'text') e.textContent = v;
      else if (k === 'class') e.className = v;
      else if (k === 'value') e.value = v;
      else if (k.indexOf('on') === 0 && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    });
    if (kids != null) (Array.isArray(kids) ? kids : [kids]).forEach(function (c) {
      if (c == null || c === false) return;
      e.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
    });
    return e;
  }
  function svgIcon(children) {
    var ns = 'http://www.w3.org/2000/svg';
    var s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '1.7'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
    children.forEach(function (c) { var el = document.createElementNS(ns, c[0]); Object.keys(c[1]).forEach(function (k) { el.setAttribute(k, c[1][k]); }); s.appendChild(el); });
    return s;
  }
  var ICONS = {
    calendar: [['rect', { x: 3, y: 4, width: 18, height: 17, rx: 2 }], ['path', { d: 'M16 2v4' }], ['path', { d: 'M8 2v4' }], ['path', { d: 'M3 10h18' }]],
    dashboard: [['rect', { x: 3, y: 3, width: 7, height: 7 }], ['rect', { x: 14, y: 3, width: 7, height: 7 }], ['rect', { x: 14, y: 14, width: 7, height: 7 }], ['rect', { x: 3, y: 14, width: 7, height: 7 }]],
    trips: [['rect', { x: 2, y: 7, width: 20, height: 14, rx: 2, ry: 2 }], ['path', { d: 'M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16' }]],
    tasks: [['polyline', { points: '9 11 12 14 22 4' }], ['path', { d: 'M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' }]],
    reports: [['line', { x1: 18, y1: 20, x2: 18, y2: 10 }], ['line', { x1: 12, y1: 20, x2: 12, y2: 4 }], ['line', { x1: 6, y1: 20, x2: 6, y2: 14 }]],
    customers: [['path', { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' }], ['circle', { cx: 9, cy: 7, r: 4 }], ['path', { d: 'M22 21v-2a4 4 0 0 0-3-3.87' }], ['path', { d: 'M16 3.13a4 4 0 0 1 0 7.75' }]],
    invoices: [['path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }], ['polyline', { points: '14 2 14 8 20 8' }], ['line', { x1: 16, y1: 13, x2: 8, y2: 13 }], ['line', { x1: 16, y1: 17, x2: 8, y2: 17 }]],
    quotes: [['line', { x1: 12, y1: 1, x2: 12, y2: 23 }], ['path', { d: 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' }]],
    itineraries: [['polygon', { points: '1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6' }], ['line', { x1: 8, y1: 2, x2: 8, y2: 18 }], ['line', { x1: 16, y1: 6, x2: 16, y2: 22 }]],
    settings: [['circle', { cx: 12, cy: 12, r: 3 }], ['path', { d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z' }]],
    search: [['circle', { cx: 11, cy: 11, r: 8 }], ['path', { d: 'M21 21l-4.35-4.35' }]],
    packages: [['path', { d: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z' }], ['polyline', { points: '3.27 6.96 12 12.01 20.73 6.96' }], ['line', { x1: 12, y1: 22.08, x2: 12, y2: 12 }], ['line', { x1: 16.5, y1: 9.4, x2: 7.5, y2: 4.21 }]],
    grouptrips: [['circle', { cx: 9, cy: 7, r: 3 }], ['path', { d: 'M2 21v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1' }], ['circle', { cx: 17.5, cy: 8.5, r: 2.2 }], ['path', { d: 'M22 21v-1a4 4 0 0 0-3.2-3.92' }]]
  };
  function mount(node) { appEl.textContent = ''; appEl.appendChild(node); }
  function initials(p) { return ((p && p.first_name ? p.first_name : (p && p.email ? p.email : '?')).charAt(0) + (p && p.last_name ? p.last_name.charAt(0) : '')).toUpperCase(); }
  function fullName(p) { if (!p) return 'Unnamed'; return [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || (p.email || 'Unnamed'); }
  function avatarBox(p, cls) {
    var span = h('span', { class: cls + (p && p.avatar_url ? ' has-img' : '') });
    if (p && p.avatar_url) span.appendChild(h('img', { src: p.avatar_url, alt: '' }));
    else span.textContent = initials(p);
    return span;
  }
  function fmtDate(s) { if (!s) return ''; var d = new Date(s.length <= 10 ? s + 'T00:00:00' : s); return isNaN(d) ? s : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
  function money(n, cur) { if (n == null || isNaN(n)) return ''; try { return n.toLocaleString(undefined, { style: 'currency', currency: cur || 'USD', maximumFractionDigits: 2 }); } catch (e) { return (cur || '$') + ' ' + n; } }
  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  function setText(id, t) { var el = document.getElementById(id); if (el) el.textContent = t; }

  /* ---------- auth gate ---------- */
  async function boot() {
    try {
      var ses = (await sb.auth.getSession()).data.session;
      if (!ses) return viewLogin();
      var admin = await isAdmin();
      if (!admin) return viewNotAdmin(ses.user.email);
      state.adminEmail = ses.user.email;
      var pr = await sb.from('profiles').select('*').eq('id', ses.user.id).maybeSingle();
      state.adminProfile = pr.data || { email: ses.user.email };
      await loadSettings();
      state.customers = (await sb.from('profiles').select('*').order('created_at', { ascending: false })).data || [];
      viewApp();
      subscribeRealtime();
      registerUpdateStatus();
      loadReqBarCount();
    } catch (e) {
      viewLogin('Could not connect. Check your internet connection and try again.');
    }
  }
  var _updSubbed = false;
  function registerUpdateStatus() {
    if (_updSubbed || !window.adminApp || !window.adminApp.onUpdateStatus) return;
    _updSubbed = true;
    window.adminApp.onUpdateStatus(function (s) {
      if (!s) return;
      var mac = window.adminApp.platform === 'darwin';
      if (s.state === 'checking') { setUpdateStatus('Checking for updates…', ''); showUpdProgress(null); }
      else if (s.state === 'available') { setUpdateStatus('Update available: version ' + (s.version || '') + (mac ? '. Use “Open the download page” below to install it.' : '. Downloading…'), 'ok'); if (mac) hideUpdProgress(); else showUpdProgress(null); }
      else if (s.state === 'downloading') { setUpdateStatus('Downloading update… ' + (s.percent != null ? s.percent + '%' : ''), ''); showUpdProgress(s.percent != null ? s.percent : null); }
      else if (s.state === 'downloaded') { setUpdateStatus('Update ready — restart to install version ' + (s.version || '') + '.', 'ok'); showUpdProgress(100); }
      else if (s.state === 'none') { setUpdateStatus('You are on the latest version.', 'ok'); hideUpdProgress(); }
      else if (s.state === 'error') { setUpdateStatus((mac ? 'This Mac build can’t install updates automatically. Use the download page below.' : 'Automatic update could not complete: ' + (s.message || 'error') + '. Use the download page below.'), 'err'); hideUpdProgress(); }
    });
  }
  function setUpdateStatus(text, kind) {
    var el = document.getElementById('update-status'); if (!el) return;
    el.textContent = text; el.className = 'set-update-status' + (kind ? ' su-' + kind : '');
  }
  function showUpdProgress(pct) {
    var bar = document.getElementById('upd-progress'), fill = document.getElementById('upd-progress-fill'); if (!bar || !fill) return;
    bar.hidden = false;
    if (pct == null) { bar.classList.add('is-indeterminate'); fill.style.width = ''; }
    else { bar.classList.remove('is-indeterminate'); fill.style.width = Math.max(0, Math.min(100, Math.round(pct))) + '%'; }
  }
  function hideUpdProgress() { var bar = document.getElementById('upd-progress'); if (bar) { bar.hidden = true; bar.classList.remove('is-indeterminate'); } }
  function fillAppVersion() {
    var el = document.getElementById('set-ver'); if (!el) return;
    if (window.adminApp && window.adminApp.appVersion) window.adminApp.appVersion().then(function (v) { var e2 = document.getElementById('set-ver'); if (e2) e2.textContent = 'v' + v; }).catch(function () { });
    else el.textContent = 'installed app only';
  }
  async function runUpdateCheck() {
    var btn = document.getElementById('set-update-btn');
    if (!window.adminApp || !window.adminApp.checkForUpdates) { setUpdateStatus('Updates are only available in the installed desktop app.', 'err'); return; }
    setUpdateStatus('Checking for updates…', ''); if (btn) btn.disabled = true;
    var r = await window.adminApp.checkForUpdates();
    if (btn) btn.disabled = false;
    if (!r || !r.ok) { setUpdateStatus((r && r.message) || 'Could not check for updates.', 'err'); return; }
    if (r.available) {
      if (window.adminApp.platform === 'darwin') { setUpdateStatus('Update available: version ' + r.latest + '. On this Mac, tap “Open the download page” below to install it (automatic install needs a signed build).', 'ok'); hideUpdProgress(); }
      else { setUpdateStatus('Update available: version ' + r.latest + '. Downloading now — you will be asked to restart when it is ready.', 'ok'); showUpdProgress(null); }
    } else { setUpdateStatus('You are on the latest version (v' + r.current + ').', 'ok'); hideUpdProgress(); }
  }
  async function isAdmin() { var r = await sb.rpc('is_admin'); return r.data === true && !r.error; }

  /* ---------- login ---------- */
  function viewLogin(note) {
    var msg = h('div', { class: 'msg err', style: 'display:none' });
    var form = h('form', { class: 'login-card', autocomplete: 'on' });
    form.addEventListener('submit', function (e) { doLogin(e, msg); });
    form.appendChild(h('p', { class: 'login-brand', text: 'Upgrade Travel' }));
    form.appendChild(h('h1', { class: 'login-title', text: 'Admin sign in' }));
    form.appendChild(h('p', { class: 'login-sub', text: 'Your business hub — customers, itineraries and quotes.' }));
    if (note) { msg.className = 'msg note'; msg.textContent = note; msg.style.display = 'block'; }
    form.appendChild(msg);
    form.appendChild(h('label', { class: 'field' }, [h('span', { text: 'Email' }), h('input', { name: 'email', type: 'email', autocomplete: 'username', required: true })]));
    form.appendChild(h('label', { class: 'field' }, [h('span', { text: 'Password' }), h('input', { name: 'password', type: 'password', autocomplete: 'current-password', required: true })]));
    form.appendChild(h('button', { class: 'btn btn-primary', type: 'submit', text: 'Sign in' }));
    form.appendChild(h('p', { class: 'login-foot', text: 'Upgrade Travel Admin v' + ((window.adminApp && window.adminApp.version) || '0.1.0') }));
    mount(h('div', { class: 'login' }, [form]));
  }
  async function doLogin(e, msg) {
    e.preventDefault();
    var f = e.target, btn = f.querySelector('button');
    var email = f.email.value.trim(), pw = f.password.value;
    msg.style.display = 'none'; btn.disabled = true; btn.textContent = 'Signing in…';
    var r = await sb.auth.signInWithPassword({ email: email, password: pw });
    if (r.error) { showErr(msg, r.error.message || 'Could not sign in.'); btn.disabled = false; btn.textContent = 'Sign in'; return; }
    var admin = await isAdmin();
    if (!admin) { await sb.auth.signOut(); showErr(msg, 'This account does not have admin access.'); btn.disabled = false; btn.textContent = 'Sign in'; return; }
    boot();
  }
  function showErr(msg, text) { msg.className = 'msg err'; msg.textContent = text; msg.style.display = 'block'; }
  function viewNotAdmin(email) {
    var card = h('div', { class: 'login-card' }, [
      h('h1', { class: 'login-title', text: 'No admin access' }),
      h('p', { class: 'login-sub', text: (email || 'This account') + ' is signed in, but it is not an admin account.' }),
      h('button', { class: 'btn btn-ghost', onclick: function () { sb.auth.signOut().then(viewLogin); }, text: 'Sign out' })
    ]);
    mount(h('div', { class: 'login' }, [card]));
  }

  /* ---------- app shell ---------- */
  var NAV_GROUPS = [
    { label: 'Overview', items: [['dashboard', 'Dashboard'], ['calendar', 'Calendar'], ['trips', 'Trips'], ['tasks', 'Tasks'], ['reports', 'Reports']] },
    { label: 'Clients', items: [['customers', 'Customers'], ['quotes', 'Quotes'], ['invoices', 'Invoices'], ['itineraries', 'Itineraries'], ['grouptrips', 'Group trips']] },
    { label: 'Library', items: [['packages', 'Packages']] }
  ];
  function navButton(n) {
    var kids = [svgIcon(ICONS[n[0]]), h('span', { text: n[1] })];
    if (n[0] === 'quotes') kids.push(h('span', { class: 'nav-badge', id: 'nav-badge-quotes', style: 'display:none' }));
    var b = h('button', { class: state.tab === n[0] ? 'is-active' : '', 'data-tab': n[0] }, kids);
    b.addEventListener('click', function () { state.tab = n[0]; refreshNav(); renderTab(); });
    return b;
  }
  function viewApp() {
    mount(h('div', { class: 'shell' }, [sideBar(), h('main', { class: 'main', id: 'main' })]));
    renderTab();
  }
  function sideBar() {
    var scroll = [];
    NAV_GROUPS.forEach(function (g) {
      scroll.push(h('div', { class: 'side-group-label', text: g.label }));
      scroll.push(h('nav', { class: 'side-nav' }, g.items.map(navButton)));
    });
    var ap = state.adminProfile || {};
    return h('aside', { class: 'side' }, [
      h('div', { class: 'side-top' }),
      h('div', { class: 'side-brand' }, [h('b', { text: 'Upgrade Travel' }), h('span', { text: 'Admin' })]),
      h('button', { class: 'side-search', onclick: openGlobalSearch, title: 'Search everything (Cmd+K)' }, [svgIcon([['circle', { cx: 11, cy: 11, r: 7 }], ['path', { d: 'm21 21-4.3-4.3' }]]), h('span', { text: 'Search everything…' })]),
      h('div', { class: 'side-scroll' }, scroll),
      h('div', { class: 'side-foot' }, [
        h('nav', { class: 'side-nav side-nav-foot' }, [navButton(['settings', 'Settings'])]),
        h('div', { class: 'side-user' }, [
          avatarBox(ap, 'side-avatar'),
          h('div', { class: 'side-user-meta' }, [h('b', { text: fullName(ap) }), h('span', { text: state.adminEmail })])
        ]),
        h('button', { class: 'side-signout', onclick: signOut, text: 'Sign out' })
      ])
    ]);
  }
  function refreshNav() {
    Array.prototype.forEach.call(document.querySelectorAll('.side-nav button'), function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-tab') === state.tab);
    });
  }
  function doSignOut() { teardownRealtime(); state.customers = []; state.selectedId = null; sb.auth.signOut().then(function () { viewLogin(); }).catch(function () { viewLogin(); }); }
  function signOut() { confirmDialog({ title: 'Sign out', message: 'Sign out of the admin?', detail: 'Anything mid-edit that is not saved will be lost.', confirmText: 'Sign out', onConfirm: doSignOut }); }
  var EMPTY_ICONS = {
    invoice: [['path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }], ['polyline', { points: '14 2 14 8 20 8' }], ['path', { d: 'M8 13h8' }], ['path', { d: 'M8 17h5' }]],
    quote: [['path', { d: 'M12 2v20' }], ['path', { d: 'M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' }]],
    itinerary: [['path', { d: 'M14.1 6.3 21 3l-3.3 6.9L21 21l-6.9-3.3L3 21l3.3-11.1L3 3z' }]],
    request: [['path', { d: 'M22 12h-6l-2 3h-4l-2-3H2' }], ['path', { d: 'M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1z' }]],
    package: [['path', { d: 'M16.5 9.4 7.55 4.24' }], ['path', { d: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z' }], ['polyline', { points: '3.29 7 12 12 20.71 7' }], ['path', { d: 'M12 22V12' }]],
    trip: [['rect', { x: 2, y: 7, width: 20, height: 14, rx: 2 }], ['path', { d: 'M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16' }]],
    task: [['path', { d: 'M9 11l3 3L22 4' }], ['path', { d: 'M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' }]]
  };
  function emptyBox(kind, title, sub) {
    return h('div', { class: 'empty-box' }, [
      h('span', { class: 'empty-ic' }, [svgIcon(EMPTY_ICONS[kind] || EMPTY_ICONS.trip)]),
      h('b', { class: 'empty-t', text: title }),
      sub ? h('span', { class: 'empty-s', text: sub }) : null
    ]);
  }
  function mainHead(title, sub) { return h('div', { class: 'main-head' }, [h('h1', { class: 'main-title', text: title }), sub ? h('p', { class: 'main-sub', text: sub }) : null]); }
  /* ---------- global search: one box for customers, quotes, invoices, itineraries ---------- */
  var _gsTimer = null;
  function openGlobalSearch() {
    if (!state.adminEmail || document.getElementById('gs-overlay')) return;
    var input = h('input', { id: 'gs-input', class: 'inv-input gs-input', type: 'text', placeholder: 'Search customers, quotes, invoices, itineraries…', autocomplete: 'off' });
    var results = h('div', { id: 'gs-results', class: 'gs-results' }, [h('div', { class: 'gs-hint', text: 'Type a name, email or number. Esc closes.' })]);
    var ov = h('div', { id: 'gs-overlay', class: 'gs-overlay' }, [h('div', { class: 'gs-box' }, [input, results])]);
    ov.addEventListener('click', function (e) { if (e.target === ov) ov.remove(); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Escape') ov.remove(); });
    input.addEventListener('input', function () { clearTimeout(_gsTimer); _gsTimer = setTimeout(function () { runGlobalSearch(input.value); }, 260); });
    document.body.appendChild(ov);
    input.focus();
  }
  function gsClose() { var ov = document.getElementById('gs-overlay'); if (ov) ov.remove(); }
  function gsRow(kindLabel, main, sub, onOpen) {
    return h('button', { type: 'button', class: 'gs-row', onclick: function () { gsClose(); onOpen(); } }, [
      h('span', { class: 'gs-kind', text: kindLabel }),
      h('span', { class: 'gs-main', text: main }),
      sub ? h('span', { class: 'gs-sub', text: sub }) : null
    ]);
  }
  async function runGlobalSearch(qRaw) {
    var box = document.getElementById('gs-results'); if (!box) return;
    var q = (qRaw || '').trim();
    if (q.length < 2) { box.textContent = ''; box.appendChild(h('div', { class: 'gs-hint', text: 'Type at least two characters.' })); return; }
    box.textContent = ''; box.appendChild(h('div', { class: 'gs-hint', text: 'Searching…' }));
    var like = '%' + q.replace(/[%_,()]/g, ' ').trim() + '%';
    var orDoc = 'title.ilike.' + like + ',customer_email.ilike.' + like;
    var res = await Promise.all([
      sb.from('quotes').select('*').or('quote_number.ilike.' + like + ',' + orDoc).order('created_at', { ascending: false }).limit(5),
      sb.from('invoices').select('*').or('invoice_number.ilike.' + like + ',' + orDoc).order('created_at', { ascending: false }).limit(5),
      sb.from('itineraries').select('*').or('itinerary_number.ilike.' + like + ',destination.ilike.' + like + ',' + orDoc).order('created_at', { ascending: false }).limit(5)
    ]);
    box = document.getElementById('gs-results'); if (!box) return;
    var ql = q.toLowerCase(), rows = [];
    var custs = (state.customers || []).filter(function (c) {
      return ((c.first_name || '') + ' ' + (c.last_name || '') + ' ' + (c.email || '') + ' ' + (c.phone || '') + ' ' + (c.account_number || '')).toLowerCase().indexOf(ql) > -1;
    }).slice(0, 5);
    custs.forEach(function (c) { rows.push(gsRow('Customer', fullName(c) || c.email, [c.email, c.account_number].filter(Boolean).join('  ·  '), function () { state.tab = 'customers'; state.selectedId = c.id; refreshNav(); renderTab(); })); });
    (res[0].data || []).forEach(function (qr) { rows.push(gsRow('Quote', qr.quote_number || 'Quote', [qr.title, findCustomerNameByEmail(qr.customer_email) || qr.customer_email].filter(Boolean).join('  ·  '), function () { adminOverlay(quoteDetail(qr), 'Quote ' + (qr.quote_number || '')); })); });
    (res[1].data || []).forEach(function (iv) { rows.push(gsRow('Invoice', iv.invoice_number || 'Invoice', [iv.title, findCustomerNameByEmail(iv.customer_email) || iv.customer_email].filter(Boolean).join('  ·  '), function () { adminOverlay(invoiceDetail(iv, (state.invCostMap || {})[iv.id]), 'Invoice ' + (iv.invoice_number || '')); })); });
    (res[2].data || []).forEach(function (it) { rows.push(gsRow('Itinerary', it.itinerary_number || 'Itinerary', [it.title || it.destination, findCustomerNameByEmail(it.customer_email) || it.customer_email].filter(Boolean).join('  ·  '), function () { adminOverlay(itinDetail(it), 'Itinerary ' + (it.itinerary_number || '')); })); });
    box.textContent = '';
    if (!rows.length) { box.appendChild(h('div', { class: 'gs-hint', text: 'Nothing matches “' + q + '”.' })); return; }
    rows.forEach(function (r) { box.appendChild(r); });
  }
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); openGlobalSearch(); }
  });
  function renderTab() {
    var main = document.getElementById('main');
    Array.prototype.forEach.call(document.querySelectorAll('.flatpickr-calendar'), function (c) { c.remove(); });
    main.textContent = '';
    state.pkgBuilding = false; /* segRow rich mode is package-scoped; packageForm re-enables it */
    state.gtBuilding = false; /* group-trip shared/pod flights re-enable rich mode per view */
    if (state.tab === 'dashboard') main.appendChild(tabDashboard());
    else if (state.tab === 'calendar') main.appendChild(tabCalendar());
    else if (state.tab === 'trips') main.appendChild(tabTrips());
    else if (state.tab === 'tasks') main.appendChild(tabTasks());
    else if (state.tab === 'reports') main.appendChild(tabReports());
    else if (state.tab === 'customers') main.appendChild(tabCustomers());
    else if (state.tab === 'invoices') main.appendChild(tabInvoices());
    else if (state.tab === 'quotes') main.appendChild(tabQuotes());
    else if (state.tab === 'itineraries') main.appendChild(tabItineraries());
    else if (state.tab === 'packages') main.appendChild(tabPackages());
    else if (state.tab === 'grouptrips') main.appendChild(tabGroupTrips());
    else main.appendChild(tabSettings());
    initDatePickers(main);
  }
  /* ---------- dashboard ---------- */
  function dnum(x) { var n = parseFloat(x); return isNaN(n) ? 0 : n; }
  function curYM() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2); }
  function tabDashboard() {
    var wrap = h('div');
    wrap.appendChild(mainHead('Dashboard', 'Your business at a glance — pulled live.'));
    var body = h('div', { class: 'main-body' });
    body.appendChild(h('div', { id: 'dash', class: 'dash' }, [h('div', { class: 'dash-loading', text: 'Loading live numbers…' })]));
    wrap.appendChild(body);
    setTimeout(loadDashboard, 0);
    return wrap;
  }
  async function loadDashboard() {
    var dash = document.getElementById('dash'); if (!dash) return;
    var res = await Promise.all([
      sb.from('profiles').select('id', { count: 'exact', head: true }),
      sb.from('quote_requests').select('status, created_at'),
      sb.from('quotes').select('*').order('created_at', { ascending: false }).limit(400),
      sb.from('invoices').select('*').order('created_at', { ascending: false }).limit(400),
      sb.from('itineraries').select('*').eq('status', 'sent').order('created_at', { ascending: false }).limit(300),
      sb.from('tasks').select('*').eq('done', false).order('due_date', { ascending: true, nullsFirst: false })
    ]);
    dash = document.getElementById('dash'); if (!dash) return;
    var custCount = res[0].count || 0;
    var reqs = res[1].data || [], quotes = res[2].data || [], invoices = res[3].data || [], its = res[4].data || [];
    var ym = curYM(), today = todayISO();
    var newReqs = 0, monthReqs = 0;
    reqs.forEach(function (r) { if (r.status === 'new') newReqs++; if ((r.created_at || '').slice(0, 7) === ym) monthReqs++; });
    var qSent = 0, qAcc = 0, qDec = 0, pipeline = 0;
    quotes.forEach(function (q) { if (q.status === 'accepted') qAcc++; else if (q.status === 'declined') qDec++; else { qSent++; pipeline += dnum(q.total_charged); } });
    var decided = qAcc + qDec, acceptRate = decided ? Math.round((qAcc / decided) * 100) : 0;
    var revenue = 0, saved = 0, mRevenue = 0, outstanding = 0, overdue = [];
    invoices.forEach(function (inv) {
      var t = dnum(inv.total_charged); revenue += t;
      var c = dnum(inv.comparable_total); if (c > t) saved += (c - t);
      if ((inv.created_at || '').slice(0, 7) === ym) mRevenue += t;
      var b = t - dnum(inv.amount_paid);
      if (b > 0.001) { outstanding += b; if (inv.due_date && inv.due_date < today) overdue.push(inv); }
    });
    var invCount = invoices.length;
    var expiring = quotes.filter(function (q) { return (q.status || 'sent') === 'sent' && q.valid_until && q.valid_until >= today && q.valid_until <= addDays(today, 3); });
    var departing = its.filter(function (it) { return it.start_date && it.start_date >= today && it.start_date <= addDays(today, 3); });
    /* last six months of billing, and how much of it has been collected */
    var months = [], byM = {};
    for (var mi = 5; mi >= 0; mi--) { var d0 = new Date(); d0.setMonth(d0.getMonth() - mi, 1); var k0 = d0.getFullYear() + '-' + ('0' + (d0.getMonth() + 1)).slice(-2); months.push(k0); byM[k0] = { billed: 0, paid: 0 }; }
    invoices.forEach(function (inv) { var k = (inv.created_at || '').slice(0, 7); if (byM[k]) { var t = dnum(inv.total_charged); byM[k].billed += t; byM[k].paid += Math.min(dnum(inv.amount_paid), t); } });

    dash.textContent = '';
    dash.appendChild(h('div', { class: 'dash-row dash-hero' }, [
      statCard('Revenue billed', money(revenue, 'USD'), 'This month ' + money(mRevenue, 'USD'), 'gold', function () { gotoDocList('invoices'); }),
      statCard('Outstanding', money(outstanding, 'USD'), overdue.length ? overdue.length + ' invoice' + (overdue.length > 1 ? 's' : '') + ' overdue' : 'nothing overdue', overdue.length ? 'amber' : null, function () { gotoDocList('invoices'); }),
      statCard('Pipeline', money(pipeline, 'USD'), 'in ' + qSent + ' open quote' + (qSent === 1 ? '' : 's'), null, function () { gotoDocList('quotes'); }),
      statCard('Saved for clients', money(saved, 'USD'), 'across ' + invCount + ' invoice' + (invCount === 1 ? '' : 's'), 'green', function () { state.tab = 'reports'; refreshNav(); renderTab(); })
    ]));
    var left = h('div', { class: 'dash-left' }, [
      dashChart(months, byM),
      dashAttention(newReqs, expiring, overdue, departing)
    ]);
    var tw = dashTasksWidget(res[5].data || [], today);
    var side = h('div', { class: 'dash-side' }, [tw, dashWeekPanel(its, quotes, invoices, today)]);
    dash.appendChild(h('div', { class: 'dash-row dash-2col' }, [left, side]));
    dash.appendChild(h('div', { class: 'dash-row dash-mini' }, [
      statCard('Customers', String(custCount), monthReqs ? monthReqs + ' request' + (monthReqs > 1 ? 's' : '') + ' this month' : 'with an account', null, function () { state.tab = 'customers'; refreshNav(); renderTab(); }),
      statCard('Trips planned', String(its.length), 'itineraries in accounts', null, function () { gotoDocList('itineraries'); }),
      statCard('Quotes', qAcc + ' won · ' + qDec + ' lost', decided ? acceptRate + '% acceptance' : 'no decisions yet', null, function () { gotoDocList('quotes'); }),
      statCard('Avg saved / trip', money(invCount ? saved / invCount : 0, 'USD'), 'per invoice', null, null)
    ]));
    dash.appendChild(h('button', { type: 'button', class: 'dash-refresh', onclick: loadDashboard, text: '↻ Refresh' }));
  }
  function fmtK(n) { return n >= 1000 ? (Math.round(n / 100) / 10) + 'k' : String(Math.round(n)); }
  function dashChart(months, byM) {
    var max = 1, any = false;
    months.forEach(function (k) { if (byM[k].billed > max) max = byM[k].billed; if (byM[k].billed > 0) any = true; });
    var bars = months.map(function (k) {
      var b = byM[k];
      var hB = Math.max(Math.round(b.billed / max * 128), b.billed > 0 ? 4 : 2);
      var pctPaid = b.billed > 0 ? Math.round(b.paid / b.billed * 100) : 0;
      var lab = new Date(k + '-01T00:00:00').toLocaleString('en-US', { month: 'short' });
      return h('div', { class: 'dash-bar', title: lab + ': ' + money(b.billed, 'USD') + ' billed · ' + money(b.paid, 'USD') + ' collected' }, [
        h('div', { class: 'dash-bar-v', text: b.billed > 0 ? '$' + fmtK(b.billed) : '' }),
        h('div', { class: 'dash-bar-col' }, [h('div', { class: 'dash-bar-billed', style: 'height:' + hB + 'px' }, [h('div', { class: 'dash-bar-paid', style: 'height:' + pctPaid + '%' })])]),
        h('div', { class: 'dash-bar-l', text: lab })
      ]);
    });
    return h('div', { class: 'dash-panel' }, [
      h('div', { class: 'dash-panel-h', text: 'Revenue · last 6 months' }),
      any ? h('div', { class: 'dash-chart' }, bars) : h('p', { class: 'dash-empty', text: 'Send your first invoice and the chart starts here.' }),
      any ? h('div', { class: 'dash-chart-key' }, [h('span', { class: 'dash-key dash-key--paid', text: 'Collected' }), h('span', { class: 'dash-key dash-key--billed', text: 'Billed' })]) : null
    ]);
  }
  function attRow(cls, text, action, onOpen) {
    return h('button', { type: 'button', class: 'dash-att', onclick: onOpen }, [
      h('span', { class: 'dash-att-dot dash-att-dot--' + cls }),
      h('span', { class: 'dash-att-t', text: text }),
      h('span', { class: 'dash-att-a', text: action })
    ]);
  }
  function dashAttention(newReqs, expiring, overdue, departing) {
    var rows = [];
    if (newReqs) rows.push(attRow('req', newReqs + ' request' + (newReqs > 1 ? 's' : '') + ' waiting for a quote', 'Open inbox', function () { gotoDocList('quotes', 'requests'); }));
    expiring.slice(0, 3).forEach(function (q) {
      rows.push(attRow('exp', (q.quote_number || 'Quote') + ' · ' + (findCustomerNameByEmail(q.customer_email) || q.customer_email || '') + ' · expires ' + fmtDate(q.valid_until), q.nudged_at ? 'Nudged ✓' : 'Follow up', function () { adminOverlay(quoteDetail(q), 'Quote ' + (q.quote_number || '')); }));
    });
    overdue.slice(0, 3).forEach(function (iv) {
      var b = Math.max(dnum(iv.total_charged) - dnum(iv.amount_paid), 0);
      rows.push(attRow('due', (iv.invoice_number || 'Invoice') + ' · ' + money(b, iv.currency || 'USD') + ' overdue since ' + fmtDate(iv.due_date), 'View', function () { adminOverlay(invoiceDetail(iv, (state.invCostMap || {})[iv.id]), 'Invoice ' + (iv.invoice_number || '')); }));
    });
    departing.slice(0, 3).forEach(function (it) {
      var who = (it.traveler_names ? ('' + it.traveler_names).split(/\n|,/)[0] : '') || findCustomerNameByEmail(it.customer_email) || it.customer_email || '';
      rows.push(attRow('dep', who + ' departs ' + fmtDate(it.start_date) + (it.title ? ' · ' + it.title : ''), 'Itinerary', function () { adminOverlay(itinDetail(it), 'Itinerary ' + (it.itinerary_number || '')); }));
    });
    return h('div', { class: 'dash-panel' }, [
      h('div', { class: 'dash-panel-h', text: 'Needs attention' }),
      rows.length ? h('div', { class: 'dash-att-list' }, rows) : h('p', { class: 'dash-empty', text: 'All clear. Nothing is waiting on you right now.' })
    ]);
  }
  function dashWeekPanel(its, quotes, invoices, today) {
    var days = [];
    for (var i = 0; i < 7; i++) {
      var d = addDays(today, i), items = [];
      its.forEach(function (it) {
        var who = (it.traveler_names ? ('' + it.traveler_names).split(/\n|,/)[0] : '') || findCustomerNameByEmail(it.customer_email) || it.customer_email || '';
        if (it.start_date === d) items.push(['dep', 'Departs · ' + who, function () { adminOverlay(itinDetail(it), 'Itinerary ' + (it.itinerary_number || '')); }]);
        if (it.end_date === d) items.push(['ret', 'Returns · ' + who, function () { adminOverlay(itinDetail(it), 'Itinerary ' + (it.itinerary_number || '')); }]);
      });
      quotes.forEach(function (q) { if ((q.status || 'sent') === 'sent' && q.valid_until === d) items.push(['exp', 'Quote expires · ' + (findCustomerNameByEmail(q.customer_email) || q.customer_email || ''), function () { adminOverlay(quoteDetail(q), 'Quote ' + (q.quote_number || '')); }]); });
      invoices.forEach(function (iv) { var b = dnum(iv.total_charged) - dnum(iv.amount_paid); if (b > 0.001 && iv.due_date === d) items.push(['due', money(b, iv.currency || 'USD') + ' due · ' + (findCustomerNameByEmail(iv.customer_email) || iv.customer_email || ''), function () { adminOverlay(invoiceDetail(iv, (state.invCostMap || {})[iv.id]), 'Invoice ' + (iv.invoice_number || '')); }]); });
      if (items.length) days.push([i, d, items]);
    }
    var kids = [h('div', { class: 'dash-panel-h' }, [h('span', { text: 'Next 7 days' }), h('button', { type: 'button', class: 'dash-panel-link', onclick: function () { state.tab = 'calendar'; refreshNav(); renderTab(); }, text: 'Full calendar →' })])];
    if (!days.length) {
      kids.push(h('p', { class: 'dash-empty', text: 'A quiet week ahead.' }));
      /* still show the horizon: the next departure beyond this week */
      var future = its.filter(function (it) { return it.start_date && it.start_date > addDays(today, 6); }).sort(function (a, b) { return a.start_date.localeCompare(b.start_date); });
      if (future.length) {
        var nx = future[0];
        var whoN = (nx.traveler_names ? ('' + nx.traveler_names).split(/\n|,/)[0] : '') || findCustomerNameByEmail(nx.customer_email) || nx.customer_email || '';
        kids.push(h('button', { type: 'button', class: 'dash-day-item', onclick: function () { adminOverlay(itinDetail(nx), 'Itinerary ' + (nx.itinerary_number || '')); } }, [
          h('span', { class: 'dash-att-dot dash-att-dot--dep' }),
          h('span', { text: 'Next departure: ' + fmtDate(nx.start_date) + ' · ' + whoN + (nx.title ? ' · ' + nx.title : '') })
        ]));
      }
    }
    days.forEach(function (dy) {
      var label = dy[0] === 0 ? 'Today' : dy[0] === 1 ? 'Tomorrow' : new Date(dy[1] + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      kids.push(h('div', { class: 'dash-day' }, [h('div', { class: 'dash-day-l', text: label })].concat(dy[2].map(function (itx) {
        return h('button', { type: 'button', class: 'dash-day-item', onclick: itx[2] }, [h('span', { class: 'dash-att-dot dash-att-dot--' + itx[0] }), h('span', { text: itx[1] })]);
      }))));
    });
    return h('div', { class: 'dash-panel' }, kids);
  }
  function statCard(label, value, sub, accent, go) {
    var el = h('div', { class: 'dash-card' + (accent ? ' dash-card--' + accent : '') + (go ? ' dash-card--link' : '') }, [
      h('div', { class: 'dash-k', text: label }), h('div', { class: 'dash-v', text: value }), sub ? h('div', { class: 'dash-sub', text: sub }) : null
    ]);
    if (go) el.addEventListener('click', go);
    return el;
  }
  /* land on a tab's LIST page: first render establishes the builder, second applies the view */
  function gotoDocList(tab, view) {
    state.tab = tab; refreshNav(); renderTab();
    if (tab === 'itineraries') state.itinView = 'list'; else state.docView = view || 'list';
    renderTab();
  }
  function toCSV(headers, rows) {
    function esc(v) { v = v == null ? '' : ('' + v); if (/^[=+\-@\t\r]/.test(v) && !/^-?\d+(\.\d+)?$/.test(v)) v = "'" + v; return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
    return [headers.map(esc).join(',')].concat(rows.map(function (r) { return r.map(esc).join(','); })).join('\r\n');
  }
  function downloadCSV(filename, csv) { if (window.adminApp && window.adminApp.saveCSV) window.adminApp.saveCSV(filename, csv); }
  function rangeDates(key) {
    var now = new Date(), y = now.getFullYear(), m = now.getMonth();
    function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
    if (key === 'ytd') return [y + '-01-01', iso(now)];
    if (key === 'mtd') return [iso(new Date(y, m, 1)), iso(now)];
    if (key === 'last') return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))];
    if (key === '90d') { var d = new Date(now); d.setDate(now.getDate() - 90); return [iso(d), iso(now)]; }
    return [null, null];
  }
  function tabReports() {
    var wrap = h('div');
    wrap.appendChild(mainHead('Reports', 'Pull the numbers for any period — and export them to CSV.'));
    var body = h('div', { class: 'main-body' });
    body.appendChild(reportFilters());
    body.appendChild(h('div', { id: 'rep-body', class: 'rep-body' }, [h('div', { class: 'dash-loading', text: 'Loading…' })]));
    wrap.appendChild(body);
    setTimeout(function () { applyReportRange(state.repRange || 'all'); }, 0);
    return wrap;
  }
  function reportFilters() {
    var presets = [['all', 'All time'], ['ytd', 'This year'], ['mtd', 'This month'], ['last', 'Last month'], ['90d', 'Last 90 days']];
    var chips = h('div', { class: 'rep-presets' }, presets.map(function (pr) {
      return h('button', { type: 'button', class: 'rep-chip', 'data-range': pr[0], onclick: function () { applyReportRange(pr[0]); }, text: pr[1] });
    }));
    var cf = h('input', { id: 'rep-from', class: 'inv-input rep-date', type: 'date' });
    var ct = h('input', { id: 'rep-to', class: 'inv-input rep-date', type: 'date' });
    var custom = h('div', { class: 'rep-custom' }, [h('span', { class: 'rep-custom-l', text: 'Custom' }), cf, h('span', { class: 'rep-arrow', text: '→' }), ct, h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto; padding:8px 14px', onclick: function () { applyReportCustom(cf.value, ct.value); }, text: 'Apply' })]);
    return h('div', { class: 'rep-filters' }, [chips, custom]);
  }
  function setRepChips(key) { Array.prototype.forEach.call(document.querySelectorAll('.rep-chip'), function (c) { c.classList.toggle('is-on', c.getAttribute('data-range') === key); }); }
  function applyReportRange(key) { state.repRange = key; setRepChips(key); var ft = rangeDates(key); loadReports(ft[0], ft[1]); }
  function applyReportCustom(from, to) { if (!from && !to) return; state.repRange = null; setRepChips(null); loadReports(from || null, to || null); }
  async function loadReports(from, to) {
    var box = document.getElementById('rep-body'); if (!box) return;
    function rq(q) { if (from) q = q.gte('created_at', from); if (to) q = q.lte('created_at', to + 'T23:59:59.999'); return q; }
    var res = await Promise.all([
      rq(sb.from('invoices').select('id, total_charged, comparable_total, currency, created_at')),
      rq(sb.from('quotes').select('status, total_charged, comparable_total, created_at')),
      rq(sb.from('quote_requests').select('delivery, created_at')),
      rq(sb.from('itineraries').select('id, created_at')),
      rq(sb.from('profiles').select('id, created_at')),
      sb.from('invoice_finance').select('invoice_id, net_cost')
    ]);
    box = document.getElementById('rep-body'); if (!box) return;
    var inv = res[0].data || [], quo = res[1].data || [], req = res[2].data || [], itin = res[3].data || [], prof = res[4].data || [];
    var cur = (inv[0] && inv[0].currency) || 'USD';
    var revenue = 0, saved = 0;
    inv.forEach(function (x) { var t = dnum(x.total_charged); revenue += t; var c = dnum(x.comparable_total); if (c > t) saved += (c - t); });
    var fin = res[5].data || [], costMap = {}; fin.forEach(function (f) { costMap[f.invoice_id] = f.net_cost; });
    var netTotal = 0; inv.forEach(function (x) { if (costMap[x.id] != null) netTotal += dnum(costMap[x.id]); });
    var profit = revenue - netTotal;
    var qSent = 0, qAcc = 0, qDec = 0, wonValue = 0;
    quo.forEach(function (x) { if (x.status === 'accepted') { qAcc++; wonValue += dnum(x.total_charged); } else if (x.status === 'declined') qDec++; else qSent++; });
    var decided = qAcc + qDec, rate = decided ? Math.round(qAcc / decided * 100) : 0;
    var reqCall = req.filter(function (r) { return r.delivery === 'call'; }).length, reqAcct = req.length - reqCall;
    var avgInv = inv.length ? revenue / inv.length : 0;
    var months = {};
    function mk(d) { return (d || '').slice(0, 7); }
    inv.forEach(function (x) { var k = mk(x.created_at); if (!k) return; months[k] = months[k] || { rev: 0, saved: 0, inv: 0, quo: 0, acc: 0 }; months[k].rev += dnum(x.total_charged); var c = dnum(x.comparable_total), t = dnum(x.total_charged); if (c > t) months[k].saved += (c - t); months[k].inv++; });
    quo.forEach(function (x) { var k = mk(x.created_at); if (!k) return; months[k] = months[k] || { rev: 0, saved: 0, inv: 0, quo: 0, acc: 0 }; months[k].quo++; if (x.status === 'accepted') months[k].acc++; });
    var mKeys = Object.keys(months).sort().reverse();

    box.textContent = '';
    var sumCsv = [['Revenue', revenue], ['Your profit', Math.round(profit)], ['Cost of sales', Math.round(netTotal)], ['Saved for clients', saved], ['Quote value won', wonValue], ['New customers', prof.length], ['Quotes sent', qSent + qAcc + qDec], ['Accepted', qAcc], ['Declined', qDec], ['Acceptance rate %', rate], ['Itineraries', itin.length], ['Avg invoice', Math.round(avgInv)], ['Requests — account', reqAcct], ['Requests — callback', reqCall]];
    box.appendChild(repSecHead('Summary', function () { downloadCSV('upgrade-summary.csv', toCSV(['Metric', 'Value'], sumCsv)); }));
    box.appendChild(h('div', { class: 'rep-sum' }, [
      statCard('Revenue', money(revenue, cur), inv.length + ' invoice' + (inv.length === 1 ? '' : 's'), 'gold'),
      statCard('Your profit', money(profit, cur), netTotal ? 'after ' + money(netTotal, cur) + ' cost' : 'add cost on invoices', 'gold'),
      statCard('Saved for clients', money(saved, cur), 'on invoices', 'green'),
      statCard('New customers', String(prof.length), 'signed up', null)
    ]));
    box.appendChild(h('div', { class: 'rep-sum' }, [
      statCard('Quotes sent', String(qSent + qAcc + qDec), qAcc + ' won · ' + qDec + ' lost', null),
      statCard('Acceptance rate', decided ? rate + '%' : '—', decided + ' decided', null),
      statCard('Itineraries', String(itin.length), 'planned', null),
      statCard('Avg invoice', money(avgInv, cur), '', null)
    ]));
    box.appendChild(reportTable('Quote requests by channel', ['Channel', 'Count'],
      [['Sent to account', String(reqAcct)], ['Wants a callback', String(reqCall)], ['Total', String(req.length)]],
      [['Sent to account', reqAcct], ['Wants a callback', reqCall], ['Total', req.length]], 'quote-requests'));
    var disp = mKeys.map(function (k) { var m = months[k]; return [k, money(m.rev, cur), money(m.saved, cur), String(m.inv), String(m.quo), String(m.acc)]; });
    var csv = mKeys.map(function (k) { var m = months[k]; return [k, m.rev, m.saved, m.inv, m.quo, m.acc]; });
    box.appendChild(reportTable('Monthly breakdown', ['Month', 'Revenue', 'Saved', 'Invoices', 'Quotes', 'Accepted'], disp, csv, 'monthly'));
  }
  function repSecHead(title, onExport) {
    return h('div', { class: 'rep-sec-head' }, [h('h3', { class: 'rep-h3', text: title }), h('button', { type: 'button', class: 'rep-export', onclick: onExport, text: '↓ Export CSV' })]);
  }
  function reportTable(title, headers, dispRows, csvRows, csvName) {
    var wrap = h('div', { class: 'rep-section' });
    wrap.appendChild(repSecHead(title, function () { downloadCSV('upgrade-' + csvName + '.csv', toCSV(headers, csvRows || dispRows)); }));
    if (!dispRows.length) { wrap.appendChild(h('div', { class: 'rep-empty', text: 'Nothing in this period.' })); return wrap; }
    var table = h('table', { class: 'rep-table' });
    table.appendChild(h('thead', null, [h('tr', null, headers.map(function (hd) { return h('th', { text: hd }); }))]));
    table.appendChild(h('tbody', null, dispRows.map(function (r) { return h('tr', null, r.map(function (c) { return h('td', { text: '' + c }); })); })));
    wrap.appendChild(table);
    return wrap;
  }

  /* ---------- tasks ---------- */
  /* ---------- calendar: the month at a glance ---------- */
  function pad2c(n) { return ('0' + n).slice(-2); }
  function tabCalendar() {
    if (state.calY == null) { var now = new Date(); state.calY = now.getFullYear(); state.calM = now.getMonth(); }
    var wrap = h('div');
    wrap.appendChild(mainHead('Calendar', 'Departures, returns, balances due and quote expiries, month by month.'));
    var body = h('div', { class: 'main-body' });
    var monthName = new Date(state.calY, state.calM, 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });
    body.appendChild(h('div', { class: 'cal-head' }, [
      h('button', { type: 'button', class: 'btn btn-ghost cal-nav', onclick: function () { state.calM--; if (state.calM < 0) { state.calM = 11; state.calY--; } renderTab(); }, text: '←' }),
      h('h3', { class: 'cal-month', text: monthName }),
      h('button', { type: 'button', class: 'btn btn-ghost cal-nav', onclick: function () { state.calM++; if (state.calM > 11) { state.calM = 0; state.calY++; } renderTab(); }, text: '→' }),
      h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto; margin-left:10px; padding:8px 14px', onclick: function () { var n2 = new Date(); state.calY = n2.getFullYear(); state.calM = n2.getMonth(); renderTab(); }, text: 'Today' }),
      h('div', { class: 'cal-legend' }, [
        h('span', { class: 'cal-key cal-key--dep', text: 'Departure' }),
        h('span', { class: 'cal-key cal-key--ret', text: 'Return' }),
        h('span', { class: 'cal-key cal-key--exp', text: 'Quote expires' }),
        h('span', { class: 'cal-key cal-key--due', text: 'Balance due' })
      ])
    ]));
    body.appendChild(h('div', { id: 'cal-box' }, [h('div', { class: 'dash-loading', text: 'Loading the month…' })]));
    wrap.appendChild(body);
    setTimeout(loadCalendar, 0);
    return wrap;
  }
  async function loadCalendar() {
    var box = document.getElementById('cal-box'); if (!box) return;
    var y = state.calY, m = state.calM;
    var first = y + '-' + pad2c(m + 1) + '-01';
    var lastD = new Date(y, m + 1, 0).getDate();
    var last = y + '-' + pad2c(m + 1) + '-' + pad2c(lastD);
    var res = await Promise.all([
      sb.from('itineraries').select('*').eq('status', 'sent').or('and(start_date.gte.' + first + ',start_date.lte.' + last + '),and(end_date.gte.' + first + ',end_date.lte.' + last + ')'),
      sb.from('quotes').select('*').eq('status', 'sent').gte('valid_until', first).lte('valid_until', last),
      sb.from('invoices').select('*').gte('due_date', first).lte('due_date', last)
    ]);
    box = document.getElementById('cal-box'); if (!box) return;
    var ev = {};
    function put(dstr, chip) { if (!dstr || dstr.slice(0, 7) !== first.slice(0, 7)) return; var k = parseInt(dstr.slice(8, 10), 10); (ev[k] = ev[k] || []).push(chip); }
    function who(email, names) { return (names ? ('' + names).split(/\n|,/)[0] : '') || findCustomerNameByEmail(email) || email || ''; }
    (res[0].data || []).forEach(function (it) {
      var w = who(it.customer_email, it.traveler_names);
      put(it.start_date, { cls: 'dep', label: 'Departs · ' + w, open: function () { adminOverlay(itinDetail(it), 'Itinerary ' + (it.itinerary_number || '')); } });
      put(it.end_date, { cls: 'ret', label: 'Returns · ' + w, open: function () { adminOverlay(itinDetail(it), 'Itinerary ' + (it.itinerary_number || '')); } });
    });
    (res[1].data || []).forEach(function (qr) {
      put(qr.valid_until, { cls: 'exp', label: 'Quote expires · ' + who(qr.customer_email), open: function () { adminOverlay(quoteDetail(qr), 'Quote ' + (qr.quote_number || '')); } });
    });
    (res[2].data || []).forEach(function (iv) {
      var bal = Math.max(dnum(iv.total_charged) - dnum(iv.amount_paid), 0);
      if (bal <= 0.001) return;
      put(iv.due_date, { cls: 'due', label: money(bal, iv.currency || 'USD') + ' due · ' + who(iv.customer_email), open: function () { adminOverlay(invoiceDetail(iv, (state.invCostMap || {})[iv.id]), 'Invoice ' + (iv.invoice_number || '')); } });
    });
    var grid = h('div', { class: 'cal-grid' });
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(function (d) { grid.appendChild(h('div', { class: 'cal-dow', text: d })); });
    var lead = new Date(y, m, 1).getDay();
    for (var b = 0; b < lead; b++) grid.appendChild(h('div', { class: 'cal-cell cal-cell--blank' }));
    var today = new Date(), isThisMonth = today.getFullYear() === y && today.getMonth() === m;
    for (var day = 1; day <= lastD; day++) {
      var chips = ev[day] || [];
      var cell = h('div', { class: 'cal-cell' + (isThisMonth && today.getDate() === day ? ' cal-cell--today' : '') }, [h('div', { class: 'cal-daynum', text: String(day) })]);
      chips.slice(0, 3).forEach(function (c) { cell.appendChild(h('button', { type: 'button', class: 'cal-chip cal-chip--' + c.cls, title: c.label, onclick: c.open, text: c.label })); });
      if (chips.length > 3) {
        (function (all, dnum2) {
          cell.appendChild(h('button', { type: 'button', class: 'cal-chip cal-chip--more', onclick: function () {
            var list = h('div', { class: 'cal-daylist' }, all.map(function (c2) { return h('button', { type: 'button', class: 'cal-chip cal-chip--' + c2.cls, style: 'width:100%; text-align:left', onclick: function () { c2.open(); }, text: c2.label }); }));
            adminOverlay(list, new Date(y, m, dnum2).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }));
          }, text: '+' + (all.length - 3) + ' more' }));
        })(chips, day);
      }
      grid.appendChild(cell);
    }
    box.textContent = '';
    box.appendChild(grid);
    if (!Object.keys(ev).length) box.appendChild(h('p', { class: 'qf-empty', text: 'Nothing scheduled this month.' }));
  }
  var TASK_CATS = ['General', 'Follow-up', 'Ticketing', 'Payment'];
  function todayISO() { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function catClass(c) { return 'task-cat-' + (c || 'general').toLowerCase().replace(/[^a-z]/g, ''); }
  function tabTasks() {
    var wrap = h('div');
    wrap.appendChild(mainHead('Tasks', 'Follow-ups, ticketing deadlines and payment reminders — so nothing slips.'));
    var body = h('div', { class: 'main-body' });
    body.appendChild(taskAddBar());
    body.appendChild(h('div', { id: 'task-list', class: 'task-list-wrap' }, [h('div', { class: 'dash-loading', text: 'Loading…' })]));
    wrap.appendChild(body);
    setTimeout(loadTasks, 0);
    return wrap;
  }
  function taskAddBar() {
    var title = h('input', { id: 'task-title', class: 'inv-input', type: 'text', placeholder: 'Add a task — e.g. Ticket the Dubai fare before it expires', autocomplete: 'off' });
    title.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submitTask(); } });
    return h('div', { class: 'task-add' }, [
      title,
      h('input', { id: 'task-due', class: 'inv-input task-add-due', type: 'date' }),
      h('div', { class: 'task-add-cat' }, [styledSelect('task-cat', 'General', TASK_CATS, null)]),
      h('button', { type: 'button', class: 'btn btn-primary', style: 'width:auto; padding:11px 20px', onclick: submitTask, text: '+ Add' })
    ]);
  }
  function submitTask() {
    var t = val('task-title'); if (!t.trim()) return;
    addTask({ title: t.trim(), due_date: val('task-due') || null, category: val('task-cat') || 'General' });
  }
  async function addTask(t) {
    t.created_by = state.adminEmail || null;
    var r = await sb.from('tasks').insert(t);
    if (!r.error) { var ti = document.getElementById('task-title'), du = document.getElementById('task-due'); if (ti) ti.value = ''; if (du) du.value = ''; await loadTasks(); }
    return r;
  }
  async function loadTasks() {
    var r = await sb.from('tasks').select('*').order('due_date', { ascending: true, nullsFirst: false });
    state.tasks = r.data || [];
    renderTaskList();
  }
  function renderTaskList() {
    var box = document.getElementById('task-list'); if (!box) return;
    box.textContent = '';
    var tasks = state.tasks || [], active = tasks.filter(function (t) { return !t.done; }), done = tasks.filter(function (t) { return t.done; });
    var today = todayISO(), groups = { overdue: [], today: [], upcoming: [], someday: [] };
    active.forEach(function (t) { var g = !t.due_date ? 'someday' : (t.due_date < today ? 'overdue' : (t.due_date === today ? 'today' : 'upcoming')); groups[g].push(t); });
    if (!active.length) box.appendChild(emptyBox('task', 'All clear', 'No open tasks. Reminders and change requests land here.'));
    [['overdue', 'Overdue'], ['today', 'Today'], ['upcoming', 'Upcoming'], ['someday', 'No date']].forEach(function (g) {
      if (!groups[g[0]].length) return;
      box.appendChild(h('div', { class: 'task-group-h task-g-' + g[0], text: g[1] + ' · ' + groups[g[0]].length }));
      box.appendChild(h('div', { class: 'task-rows' }, groups[g[0]].map(taskRow)));
    });
    if (done.length) {
      box.appendChild(h('div', { class: 'task-group-h task-done-h', text: 'Done · ' + done.length }));
      box.appendChild(h('div', { class: 'task-rows' }, done.slice(0, 12).map(taskRow)));
    }
  }
  function taskRow(t) {
    var cust = t.customer_email ? (findCustomerNameByEmail(t.customer_email) || t.customer_email) : '';
    var today = todayISO();
    var dueCls = !t.done && t.due_date ? (t.due_date < today ? ' is-over' : (t.due_date === today ? ' is-today' : '')) : '';
    var meta = [t.due_date ? fmtDate(t.due_date) : '', cust].filter(Boolean).join('  ·  ');
    return h('div', { class: 'task-row' + (t.done ? ' is-done' : '') }, [
      h('button', { type: 'button', class: 'task-check' + (t.done ? ' is-checked' : ''), onclick: function () { toggleTask(t); }, title: t.done ? 'Mark not done' : 'Mark done' }),
      h('div', { class: 'task-main' }, [h('div', { class: 'task-title', text: t.title }), meta ? h('div', { class: 'task-meta' + dueCls, text: meta }) : null]),
      t.category ? h('span', { class: 'task-cat ' + catClass(t.category), text: t.category }) : null,
      h('button', { type: 'button', class: 'task-del', onclick: function () { confirmDialog({ title: 'Delete task', message: 'Delete \u201c' + (t.title || 'this task') + '\u201d?', danger: true, confirmText: 'Delete task', onConfirm: function () { deleteTask(t.id); } }); }, title: 'Delete', text: '×' })
    ]);
  }
  async function toggleTask(t) {
    var nd = !t.done, at = nd ? new Date().toISOString() : null;
    await sb.from('tasks').update({ done: nd, done_at: at }).eq('id', t.id);
    t.done = nd; t.done_at = at;
    renderTaskList();
  }
  async function deleteTask(id) {
    await sb.from('tasks').delete().eq('id', id);
    state.tasks = (state.tasks || []).filter(function (t) { return t.id !== id; });
    renderTaskList();
  }
  function dashTasksWidget(tasks, today) {
    if (!tasks.length) return null;
    var overdueToday = tasks.filter(function (t) { return t.due_date && t.due_date <= today; });
    var rest = tasks.filter(function (t) { return !(t.due_date && t.due_date <= today); });
    var show = overdueToday.concat(rest).slice(0, 6), nAtt = overdueToday.length;
    var wrap = h('div', { class: 'dash-tasks' + (nAtt ? ' is-att' : '') });
    wrap.appendChild(h('div', { class: 'dash-tasks-h' }, [
      h('span', { class: 'dash-tasks-t', text: nAtt ? nAtt + (nAtt === 1 ? ' task needs' : ' tasks need') + ' attention' : 'Upcoming tasks' }),
      h('button', { type: 'button', class: 'dash-tasks-all', onclick: function () { state.tab = 'tasks'; refreshNav(); renderTab(); }, text: 'All tasks →' })
    ]));
    show.forEach(function (t) {
      var over = t.due_date && t.due_date < today, tod = t.due_date === today;
      wrap.appendChild(h('div', { class: 'dash-task-row' }, [
        h('button', { type: 'button', class: 'task-check', onclick: function () { toggleTask(t).then(function () { loadDashboard(); }).catch(function (e) { console.warn('task toggle failed', e); }); }, title: 'Mark done' }),
        h('div', { class: 'task-title', text: t.title }),
        t.category ? h('span', { class: 'task-cat ' + catClass(t.category), text: t.category }) : null,
        h('span', { class: 'dash-task-due' + (over ? ' is-over' : tod ? ' is-today' : ''), text: t.due_date ? fmtDate(t.due_date) : '—' })
      ]));
    });
    return wrap;
  }
  function addReminderInline(p, btn) {
    var existing = document.getElementById('cd-rem-form'); if (existing) { existing.remove(); return; }
    var form = h('div', { id: 'cd-rem-form', class: 'cd-rem-form' }, [
      h('input', { id: 'cd-rem-title', class: 'inv-input', type: 'text', placeholder: 'Reminder about ' + (fullName(p) || 'this customer'), autocomplete: 'off' }),
      h('input', { id: 'cd-rem-due', class: 'inv-input', type: 'date', style: 'width:150px' }),
      h('button', { type: 'button', class: 'btn btn-primary', style: 'width:auto; padding:9px 16px', onclick: function (e) { saveReminder(p, e.target); }, text: 'Save' })
    ]);
    btn.closest('.cd-actions').appendChild(form);
    setTimeout(function () { var ti = document.getElementById('cd-rem-title'); if (ti) ti.focus(); }, 0);
  }
  async function saveReminder(p, btn) {
    var title = val('cd-rem-title'); if (!title.trim()) return;
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    await addTask({ title: title.trim(), due_date: val('cd-rem-due') || null, category: 'Follow-up', customer_id: p.id, customer_email: p.email });
    var f = document.getElementById('cd-rem-form'); if (f) f.replaceWith(h('span', { class: 'cd-crm-saved ok', text: 'Reminder added ✓' }));
  }

  /* ---------- trips overview ---------- */
  function addDays(iso, n) { var d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function tabTrips() {
    var wrap = h('div');
    wrap.appendChild(mainHead('Trips', 'Every trip and where it stands — quoted, booked, ticketed, travelled.'));
    var body = h('div', { class: 'main-body' });
    body.appendChild(tripFilters());
    body.appendChild(h('div', { id: 'trips-body', class: 'trips-body' }, [h('div', { class: 'dash-loading', text: 'Loading…' })]));
    wrap.appendChild(body);
    setTimeout(loadTrips, 0);
    return wrap;
  }
  function tripFilters() {
    var presets = [['all', 'All'], ['upcoming', 'Upcoming'], ['quoted', 'Quoted'], ['booked', 'Booked'], ['ticketed', 'Ticketed'], ['itinerary', 'Itinerary sent'], ['traveled', 'Travelled']];
    return h('div', { class: 'rep-presets', style: 'margin-bottom:18px' }, presets.map(function (pr) {
      return h('button', { type: 'button', class: 'rep-chip trip-chip' + ((state.tripFilter || 'all') === pr[0] ? ' is-on' : ''), 'data-f': pr[0], onclick: function () { state.tripFilter = pr[0]; Array.prototype.forEach.call(document.querySelectorAll('.trip-chip'), function (c) { c.classList.toggle('is-on', c.getAttribute('data-f') === pr[0]); }); renderTrips(); }, text: pr[1] });
    }));
  }
  function makeTrip(kind, row) {
    var seg = (row.segments || [])[0], depart = seg && seg.depart_date ? seg.depart_date : null;
    if (kind === 'itinerary') {
      var over = row.end_date && row.end_date < todayISO();
      return { kind: kind, row: row, number: row.itinerary_number, depart: row.start_date || depart, route: quoteRouteLabel(row) || row.destination, stage: over ? 'traveled' : 'itinerary', email: row.customer_email };
    }
    var stage = kind === 'quote' ? 'quoted' : (row.status === 'traveled' ? 'traveled' : (row.status === 'ticketed' ? 'ticketed' : 'booked'));
    return { kind: kind, row: row, number: row.quote_number || row.invoice_number, depart: depart, route: quoteRouteLabel(row), stage: stage, email: row.customer_email };
  }
  async function loadTrips() {
    var box = document.getElementById('trips-body'); if (!box) return;
    var res = await Promise.all([
      sb.from('quotes').select('id, quote_number, customer_email, segments, total_charged, currency, status').eq('status', 'sent').order('created_at', { ascending: false }),
      sb.from('invoices').select('id, invoice_number, customer_email, segments, total_charged, amount_paid, currency, status, created_at').order('created_at', { ascending: false }),
      sb.from('itineraries').select('*').eq('status', 'sent').order('created_at', { ascending: false }).limit(200)
    ]);
    box = document.getElementById('trips-body'); if (!box) return;
    var trips = [];
    (res[0].data || []).forEach(function (q) { trips.push(makeTrip('quote', q)); });
    var invByNum = {};
    (res[1].data || []).forEach(function (i) { var t = makeTrip('invoice', i); trips.push(t); if (i.invoice_number) invByNum[i.invoice_number] = t; });
    /* an itinerary whose pricing came from an invoice IS that trip: annotate instead of duplicating */
    (res[2].data || []).forEach(function (it) {
      var linked = it.price_invoice_number && invByNum[it.price_invoice_number];
      if (linked) { linked.hasItin = it; return; }
      trips.push(makeTrip('itinerary', it));
    });
    trips.sort(function (a, b) { if (!a.depart && !b.depart) return 0; if (!a.depart) return 1; if (!b.depart) return -1; return a.depart.localeCompare(b.depart); });
    state.trips = trips;
    renderTrips();
  }
  function renderTrips() {
    var box = document.getElementById('trips-body'); if (!box) return;
    box.textContent = '';
    var f = state.tripFilter || 'all', today = todayISO();
    var trips = (state.trips || []).filter(function (t) {
      if (f === 'all') return true;
      if (f === 'upcoming') return t.stage !== 'traveled' && (!t.depart || t.depart >= today);
      return t.stage === f;
    });
    if (!trips.length) { box.appendChild(emptyBox('trip', 'No trips in this view', 'Quotes, invoices and itineraries roll up here as trips.')); return; }
    box.appendChild(h('div', { class: 'trip-list' }, trips.map(tripCard)));
  }
  function tripCard(t) {
    var row = t.row, cur = row.currency || 'USD', today = todayISO();
    var stageLabels = { quoted: 'Quoted', booked: 'Booked', ticketed: 'Ticketed', itinerary: 'Itinerary sent', traveled: 'Travelled' };
    var bits = [t.number, t.route, money(dnum(row.total_charged), cur)];
    var departTxt = t.depart ? fmtDate(t.depart) : 'No date';
    var departCls = t.depart && t.stage !== 'traveled' ? (t.depart < today ? ' is-over' : (t.depart <= addDays(today, 7) ? ' is-soon' : '')) : '';
    var payBadge = null;
    if (t.kind === 'invoice') {
      var total = dnum(row.total_charged), paid = dnum(row.amount_paid), st = total - paid <= 0.001 ? 'paid' : (paid > 0 ? 'partial' : 'unpaid');
      payBadge = h('span', { class: 'sq-badge inv-st-' + st, text: st === 'paid' ? 'Paid' : st === 'partial' ? 'Partial' : 'Unpaid' });
    }
    var actions = [];
    if (t.hasItin) actions.push(h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto; padding:7px 13px', onclick: function () { adminOverlay(itinDetail(t.hasItin), 'Itinerary ' + (t.hasItin.itinerary_number || '')); }, text: 'Itinerary ✓' }));
    if (t.kind === 'itinerary') actions.push(h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto; padding:7px 13px', onclick: function () { adminOverlay(itinDetail(row), 'Itinerary ' + (row.itinerary_number || '')); }, text: 'View' }));
    else if (t.kind === 'quote') actions.push(h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto; padding:7px 13px', onclick: function () { convertQuoteToInvoice(row); }, text: '→ Invoice' }));
    else if (t.stage === 'booked') actions.push(h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto; padding:7px 13px', onclick: function () { advanceTrip(row, 'ticketed'); }, text: 'Mark ticketed' }));
    else if (t.stage === 'ticketed') actions.push(h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto; padding:7px 13px', onclick: function () { advanceTrip(row, 'traveled'); }, text: 'Mark travelled' }));
    else actions.push(h('span', { class: 'trip-done', text: '✓ Done' }));
    return h('div', { class: 'trip-card' }, [
      h('div', { class: 'trip-stage trip-st-' + t.stage }, [h('span', { class: 'trip-stage-dot' }), h('span', { text: stageLabels[t.stage] })]),
      h('div', { class: 'trip-main' }, [
        h('div', { class: 'trip-top' }, [h('div', { class: 'trip-name', text: findCustomerNameByEmail(t.email) || t.email }), payBadge]),
        h('div', { class: 'trip-sub', text: bits.filter(Boolean).join('  ·  ') })
      ]),
      h('div', { class: 'trip-depart' + departCls }, [h('span', { class: 'trip-depart-l', text: 'Departs' }), h('span', { class: 'trip-depart-d', text: departTxt })]),
      h('div', { class: 'trip-act' }, actions)
    ]);
  }
  async function advanceTrip(row, stage) {
    await sb.from('invoices').update({ status: stage }).eq('id', row.id);
    loadTrips();
  }

  function tabPlaceholder(title, ic, body) {
    var wrap = h('div'); wrap.appendChild(mainHead(title));
    wrap.appendChild(h('div', { class: 'main-body' }, [h('div', { class: 'placeholder' }, [svgIcon(ic), h('b', { text: title }), h('p', { text: body })])]));
    return wrap;
  }

  /* ---------- customers ---------- */
  function tabCustomers() {
    var wrap = h('div');
    wrap.appendChild(mainHead('Customers', 'Everyone with an account on flyupgrade.com — updates live as people sign up.'));
    var searchInput = h('input', { id: 'cust-q', type: 'text', placeholder: 'Search name, email, account no. or phone…', value: state.query, autocomplete: 'off' });
    searchInput.addEventListener('input', function (e) { state.query = e.target.value; renderCustRows(); });
    var addBtn = h('button', { class: 'btn btn-primary', style: 'width:100%; margin-bottom:10px', text: '+ New customer' });
    addBtn.addEventListener('click', function () { state.selectedId = null; state.custEditing = null; state.custNew = true; renderCustRows(); renderCustNew(); });
    var left = h('div', { id: 'cust-left' }, [
      addBtn,
      h('div', { class: 'cust-search' }, [svgIcon(ICONS.search), searchInput]),
      h('p', { class: 'cust-count', id: 'cust-count' }),
      h('div', { class: 'cust-list', id: 'cust-list' })
    ]);
    wrap.appendChild(h('div', { class: 'main-body' }, [h('div', { class: 'cust-wrap' }, [left, h('div', { id: 'cust-right' })])]));
    setTimeout(loadCustomers, 0);
    return wrap;
  }
  async function loadCustomers() {
    if (!document.getElementById('cust-list')) return;
    if (state.customers.length) { renderCustRows(); renderCustDetail(); } else setText('cust-count', 'Loading…');
    var r = await sb.from('profiles').select('*').order('created_at', { ascending: false });
    if (r.error) { if (!state.customers.length) setText('cust-count', r.error.message); return; }
    state.customers = r.data || [];
    if (document.getElementById('cust-list')) { renderCustRows(); renderCustDetail(); }
  }
  function renderCustRows() {
    var list = document.getElementById('cust-list'); if (!list) return;
    var q = state.query.toLowerCase();
    var rows = state.customers.filter(function (p) {
      if (!q) return true;
      return (fullName(p) + ' ' + (p.email || '') + ' ' + (p.account_number || '') + ' ' + (p.phone || '')).toLowerCase().indexOf(q) > -1;
    });
    setText('cust-count', rows.length + (rows.length === 1 ? ' customer' : ' customers'));
    list.textContent = '';
    rows.forEach(function (p) {
      var row = h('button', { class: 'cust-row' + (p.id === state.selectedId ? ' is-active' : '') }, [
        avatarBox(p, 'cust-av'),
        h('div', { class: 'cust-row-meta' }, [h('div', { class: 'cust-row-name', text: fullName(p) }), h('div', { class: 'cust-row-sub', text: p.email || '' })]),
        p.account_number ? h('div', { class: 'cust-row-no', text: '#' + p.account_number }) : null
      ]);
      row.addEventListener('click', function () { state.custEditing = null; state.selectedId = p.id; renderCustRows(); renderCustDetail(); });
      list.appendChild(row);
    });
    if (!rows.length) list.appendChild(h('p', { class: 'cust-count', text: q ? 'No matches.' : 'No customers yet.' }));
  }
  var _rtSubbed = false, _rtChannel = null;
  function subscribeRealtime() {
    if (_rtSubbed || !sb.channel) return; _rtSubbed = true;
    _rtChannel = sb.channel('profiles-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, function (p) { upsertCustomer(p.new); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, function (p) { upsertCustomer(p.new); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'quote_requests' }, function () { loadReqBarCount(); if (state.tab === 'quotes' && state.docView === 'requests') loadRequests(); else if (state.tab === 'dashboard') loadDashboard(); });
    _rtChannel.subscribe();
  }
  /* remove the live channel and clear the guard so the next sign-in re-subscribes cleanly. Idempotent. */
  function teardownRealtime() {
    try { if (_rtChannel && sb.removeChannel) sb.removeChannel(_rtChannel); } catch (e) {}
    _rtChannel = null; _rtSubbed = false;
  }
  function upsertCustomer(row) {
    if (!row || !row.id) return;
    var found = false;
    for (var i = 0; i < state.customers.length; i++) { if (state.customers[i].id === row.id) { state.customers[i] = row; found = true; break; } }
    if (!found) state.customers.unshift(row);
    if (state.tab === 'customers') renderCustRows(); else if (state.tab === 'dashboard') loadDashboard();
  }
  function kv(label, value, full) {
    return h('div', { class: 'cd-item' + (full ? ' cd-full' : '') }, [
      h('div', { class: 'k', text: label }),
      value ? h('div', { class: 'v', text: value }) : h('div', { class: 'v empty', text: 'Not provided' })
    ]);
  }
  function group(title, items) { return h('div', { class: 'cd-group' }, [h('h4', { text: title }), h('div', { class: 'cd-grid' }, items)]); }
  function renderCustDetail() {
    var right = document.getElementById('cust-right'); if (!right) return;
    right.textContent = '';
    var p = state.customers.filter(function (c) { return c.id === state.selectedId; })[0];
    if (!p) { right.appendChild(h('div', { class: 'cust-detail' }, [h('div', { class: 'cust-empty', text: 'Select a customer to see their details.' })])); return; }
    if (state.custEditing === p.id) { right.appendChild(custEditForm(p)); return; }
    var addr = [p.address_line, p.address_city, p.address_state, p.address_postal, p.address_country].filter(Boolean).join(', ');
    var rel = p.emergency_contact_relationship === 'Other' ? (p.emergency_contact_relationship_other || 'Other') : p.emergency_contact_relationship;
    var card = h('div', { class: 'cust-detail' }, [
      h('div', { class: 'cd-head' }, [
        avatarBox(p, 'cd-av'),
        h('div', null, [h('h2', { class: 'cd-name', text: [p.title, fullName(p)].filter(Boolean).join(' ') }),
          h('p', { class: 'cd-no' }, p.account_number ? ['Account no. ', h('b', { text: p.account_number }), '  ·  joined ' + fmtDate(p.created_at)] : ['Joined ' + fmtDate(p.created_at)])]),
        h('button', { class: 'cd-edit-btn', onclick: function () { state.custEditing = p.id; renderCustDetail(); }, text: 'Edit profile' })
      ]),
      h('div', { id: 'cd-stats', class: 'cd-stats' }),
      group('Identity', [kv('First name', p.first_name), kv('Middle name', p.middle_name), kv('Last name', p.last_name), kv('Gender', p.gender), kv('Date of birth', fmtDate(p.date_of_birth))]),
      group('Contact', [kv('Email', p.email), kv('Phone', p.phone), kv('Address', addr, true)]),
      group('Travel documents', [kv('Passport number', p.passport_number), kv('Passport expiry', fmtDate(p.passport_expiry)), kv('Nationality', p.nationality), kv('Country of residence', p.country_of_residence), kv('Known Traveler / TSA', p.known_traveler_number), kv('Redress number', p.redress_number)]),
      group('Preferences', [kv('Cabin', p.cabin_pref), kv('Seat', p.seat_pref), kv('Meal', p.meal_pref), kv('Frequent flyer', p.frequent_flyer)]),
      group('Emergency contact', [kv('Name', p.emergency_contact_name), kv('Phone', p.emergency_contact_phone), kv('Relationship', rel)]),
      h('div', { id: 'cd-bookings', class: 'cd-group' }, [h('h4', { text: 'Past trips & savings ledger' }), h('div', { class: 'cd-hist-loading', text: 'Loading…' })]),
      h('div', { id: 'cd-crm', class: 'cd-group cd-crm' }, [h('h4', { text: 'Concierge notes' }), h('div', { class: 'cd-hist-loading', text: 'Loading notes…' })]),
      h('div', { id: 'cd-drafts', class: 'cd-group' }, [h('h4', { text: 'Saved drafts' }), h('div', { class: 'cd-hist-loading', text: 'Loading…' })]),
      h('div', { id: 'cd-history', class: 'cd-group cd-history' }, [h('h4', { text: 'History' }), h('div', { class: 'cd-hist-loading', text: 'Loading…' })]),
      h('div', { class: 'cd-actions' }, [
        h('button', { class: 'btn btn-primary', style: 'width:auto', onclick: function () { state.builderTab = 'quote'; state.docKind = 'quote'; state.docView = 'form'; state.docDraft = null; state.draftId = null; state.docCustomer = p; state.tab = 'quotes'; refreshNav(); renderTab(); }, text: 'New quote' }),
        h('button', { class: 'btn btn-ghost', onclick: function () { state.builderTab = 'invoice'; state.docKind = 'invoice'; state.docView = 'form'; state.docDraft = null; state.draftId = null; state.docCustomer = p; state.tab = 'invoices'; refreshNav(); renderTab(); }, text: 'New invoice' }),
        h('button', { class: 'btn btn-ghost', onclick: function () { state.builderTab = 'itinerary'; state.itinView = 'form'; state.itinDraft = null; state.draftId = null; state.docCustomer = p; state.tab = 'itineraries'; refreshNav(); renderTab(); }, text: 'New itinerary' }),
        h('button', { class: 'btn btn-ghost', onclick: function (e) { addReminderInline(p, e.target); }, text: '+ Reminder' })
      ])
    ]);
    right.appendChild(card);
    setTimeout(function () { loadCustomerHistory(p); loadCustomerCRM(p); loadCustBookings(p); loadCustDrafts(p); }, 0);
  }
  /* the legacy savings ledger: trips from before the app era, so lifetime savings are honest */
  async function loadCustBookings(p) {
    var box = document.getElementById('cd-bookings'); if (!box) return;
    var r = await sb.from('bookings').select('*').ilike('customer_email', p.email || '').order('depart_at', { ascending: false });
    box = document.getElementById('cd-bookings'); if (!box) return;
    box.textContent = '';
    box.appendChild(h('h4', { text: 'Past trips & savings ledger' }));
    box.appendChild(h('p', { class: 'cd-book-hint', text: 'Trips from before the app. They count toward the customer\u2019s lifetime savings. New trips come from itineraries and invoices automatically.' }));
    var rows = r.data || [];
    rows.forEach(function (b) {
      var route = [b.from_city, b.to_city].filter(Boolean).join(' → ');
      var bits = [b.airline, b.depart_at ? fmtDate(b.depart_at) : '', (Number(b.amount_saved) > 0 ? 'saved ' + money(dnum(b.amount_saved), b.currency || 'USD') : '')].filter(Boolean).join('  ·  ');
      box.appendChild(h('div', { class: 'cd-book-row' }, [
        h('div', { class: 'cd-book-main' }, [h('b', { text: route || b.hotel_name || 'Trip' }), h('span', { class: 'cd-book-sub', text: bits })]),
        h('button', { type: 'button', class: 'cd-book-del', title: 'Remove', onclick: function () { confirmDialog({ title: 'Remove past trip', message: 'Remove “' + (route || 'this trip') + '\u201d from the ledger?', detail: 'The customer\u2019s lifetime savings drop by ' + money(dnum(b.amount_saved), b.currency || 'USD') + '.', danger: true, confirmText: 'Remove', onConfirm: function () { sb.from('bookings').delete().eq('id', b.id).then(function () { loadCustBookings(p); }); } }); }, text: '×' })
      ]));
    });
    if (!rows.length) box.appendChild(h('p', { class: 'cd-book-none', text: 'Nothing logged yet.' }));
    var formOpen = false;
    var addBtn = h('button', { type: 'button', class: 'inv-addline', text: '+ Log a past trip' });
    var formHost = h('div');
    addBtn.addEventListener('click', function () {
      if (formOpen) return; formOpen = true; addBtn.style.display = 'none';
      var f = h('div', { class: 'cd-book-form' }, [
        h('div', { class: 'inv-row2' }, [
          h('label', { class: 'inv-field' }, [h('span', { text: 'From (city)' }), h('input', { class: 'inv-input', id: 'bk-from', type: 'text', autocomplete: 'off' })]),
          h('label', { class: 'inv-field' }, [h('span', { text: 'To (city)' }), h('input', { class: 'inv-input', id: 'bk-to', type: 'text', autocomplete: 'off' })])
        ]),
        h('div', { class: 'inv-row2' }, [
          h('label', { class: 'inv-field' }, [h('span', { text: 'Airline (optional)' }), h('input', { class: 'inv-input', id: 'bk-air', type: 'text', autocomplete: 'off' })]),
          h('label', { class: 'inv-field' }, [h('span', { text: 'Departure date' }), h('input', { class: 'inv-input', id: 'bk-dep', type: 'date' })])
        ]),
        h('div', { class: 'inv-row2' }, [
          h('label', { class: 'inv-field' }, [h('span', { text: 'They paid' }), h('input', { class: 'inv-input', id: 'bk-paid', type: 'number', min: '0', step: '0.01' })]),
          h('label', { class: 'inv-field' }, [h('span', { text: 'Retail price elsewhere' }), h('input', { class: 'inv-input', id: 'bk-retail', type: 'number', min: '0', step: '0.01' })])
        ]),
        h('div', { style: 'display:flex; gap:10px; align-items:center' }, [
          h('button', { type: 'button', class: 'btn btn-primary', style: 'width:auto; padding:9px 16px', onclick: function (e) { saveCustBooking(p, e.target); }, text: 'Save trip' }),
          h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto; padding:9px 14px', onclick: function () { formHost.textContent = ''; formOpen = false; addBtn.style.display = ''; }, text: 'Cancel' }),
          h('span', { id: 'bk-msg', class: 'cd-crm-saved' })
        ])
      ]);
      formHost.appendChild(f);
      initDatePickers(f);
    });
    box.appendChild(addBtn); box.appendChild(formHost);
  }
  async function saveCustBooking(p, btn) {
    var msg = document.getElementById('bk-msg');
    var paid = parseFloat(val('bk-paid')), retail = parseFloat(val('bk-retail'));
    if (isNaN(paid)) paid = 0; if (isNaN(retail)) retail = 0;
    var fromC = val('bk-from'), toC = val('bk-to');
    if (!fromC && !toC) { if (msg) { msg.textContent = 'Add at least the route.'; msg.className = 'cd-crm-saved err'; } return; }
    btn.disabled = true; btn.textContent = 'Saving…';
    var row = { customer_email: p.email, user_id: p.id, status: 'traveled', from_city: fromC || null, to_city: toC || null, airline: val('bk-air') || null, depart_at: val('bk-dep') || null, amount_charged: paid || null, retail_price: retail || null, amount_saved: (retail > paid ? retail - paid : 0) || null, currency: (state.settings && state.settings.default_currency) || 'USD' };
    var r = await sb.from('bookings').insert(row);
    btn.disabled = false; btn.textContent = 'Save trip';
    if (r.error) { if (msg) { msg.textContent = r.error.message || 'Could not save.'; msg.className = 'cd-crm-saved err'; } return; }
    loadCustBookings(p);
  }
  var EDIT_FIELDS = [
    ['Identity', [['title', 'Title', 'text'], ['first_name', 'First name', 'text'], ['middle_name', 'Middle name', 'text'], ['last_name', 'Last name', 'text'], ['gender', 'Gender', 'text'], ['date_of_birth', 'Date of birth', 'date']]],
    ['Contact', [['phone', 'Phone', 'text'], ['address_line', 'Address', 'text'], ['address_city', 'City', 'text'], ['address_state', 'State / region', 'text'], ['address_postal', 'Postal code', 'text'], ['address_country', 'Country', 'text']]],
    ['Travel documents', [['passport_number', 'Passport number', 'text'], ['passport_expiry', 'Passport expiry', 'date'], ['nationality', 'Nationality', 'text'], ['country_of_residence', 'Country of residence', 'text'], ['known_traveler_number', 'Known Traveler / TSA', 'text'], ['redress_number', 'Redress number', 'text']]],
    ['Preferences', [['cabin_pref', 'Cabin', 'text'], ['seat_pref', 'Seat', 'text'], ['meal_pref', 'Meal', 'text'], ['frequent_flyer', 'Frequent flyer', 'text']]],
    ['Emergency contact', [['emergency_contact_name', 'Name', 'text'], ['emergency_contact_phone', 'Phone', 'text'], ['emergency_contact_relationship', 'Relationship', 'text']]]
  ];
  function custEditForm(p) {
    var card = h('div', { class: 'cust-detail cd-edit' }, [
      h('div', { class: 'cd-head' }, [avatarBox(p, 'cd-av'), h('div', null, [h('h2', { class: 'cd-name', text: 'Editing ' + (fullName(p) || 'customer') }), h('p', { class: 'cd-no', text: p.email || '' })])])
    ]);
    card.appendChild(h('p', { class: 'cd-edit-hint', text: 'Fill in anything the customer has not. Email and account number cannot be changed here.' }));
    EDIT_FIELDS.forEach(function (g) {
      card.appendChild(h('div', { class: 'cd-group' }, [h('h4', { text: g[0] }), h('div', { class: 'cd-grid' }, g[1].map(function (f) {
        var dv = f[2] === 'date' ? (p[f[0]] ? ('' + p[f[0]]).slice(0, 10) : '') : (p[f[0]] || '');
        return h('label', { class: 'inv-field' }, [h('span', { text: f[1] }), h('input', { id: 'ce-' + f[0], class: 'inv-input', type: f[2], value: dv })]);
      }))]));
    });
    card.appendChild(h('div', { class: 'cd-actions' }, [
      h('button', { class: 'btn btn-primary', style: 'width:auto', onclick: function (e) { saveCustEdit(p, e.target); }, text: 'Save changes' }),
      h('button', { class: 'btn btn-ghost', onclick: function () { state.custEditing = null; renderCustDetail(); }, text: 'Cancel' }),
      h('span', { id: 'ce-msg', class: 'cd-crm-saved' })
    ]));
    return card;
  }
  async function saveCustEdit(p, btn) {
    var msg = document.getElementById('ce-msg'), payload = {};
    EDIT_FIELDS.forEach(function (g) { g[1].forEach(function (f) { payload[f[0]] = val('ce-' + f[0]) || null; }); });
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    var r = await sb.from('profiles').update(payload).eq('id', p.id).select().maybeSingle();
    if (btn) { btn.disabled = false; btn.textContent = 'Save changes'; }
    if (r.error) { if (msg) { msg.textContent = r.error.message || 'Could not save'; msg.className = 'cd-crm-saved err'; } return; }
    if (r.data) { for (var i = 0; i < state.customers.length; i++) { if (state.customers[i].id === p.id) { state.customers[i] = r.data; break; } } }
    state.custEditing = null;
    renderCustDetail();
    renderCustRows();
  }
  function renderCustNew() {
    var right = document.getElementById('cust-right'); if (!right) return;
    right.textContent = '';
    var mk = function (id, label, type) { return h('label', { class: 'inv-field' }, [h('span', { text: label }), h('input', { id: id, class: 'inv-input', type: type || 'text', autocomplete: 'off' })]); };
    right.appendChild(h('div', { class: 'cust-detail cd-edit' }, [
      h('div', { class: 'cd-head' }, [h('div', null, [h('h2', { class: 'cd-name', text: 'New customer' }), h('p', { class: 'cd-no', text: 'Adds them everywhere — this app, the website account system and WordPress.' })])]),
      h('div', { class: 'cd-group' }, [h('h4', { text: 'Details' }), h('div', { class: 'cd-grid' }, [
        mk('nc-first', 'First name'), mk('nc-last', 'Last name'), mk('nc-email', 'Email', 'email'), mk('nc-phone', 'Phone (optional)', 'tel')
      ])]),
      h('div', { class: 'cd-actions' }, [
        h('button', { class: 'btn btn-primary', style: 'width:auto', onclick: function (e) { saveCustNew(e.target); }, text: 'Add customer' }),
        h('button', { class: 'btn btn-ghost', onclick: function () { state.custNew = false; renderCustDetail(); }, text: 'Cancel' }),
        h('span', { id: 'nc-msg', class: 'cd-crm-saved' })
      ])
    ]));
  }
  async function saveCustNew(btn) {
    var msg = document.getElementById('nc-msg');
    var email = (val('nc-email') || '').trim();
    if (!email) { if (msg) { msg.textContent = 'Email is required.'; msg.className = 'cd-crm-saved err'; } return; }
    if (btn) { btn.disabled = true; btn.textContent = 'Adding…'; }
    var body = { email: email, first_name: val('nc-first') || '', last_name: val('nc-last') || '', phone: val('nc-phone') || '' };
    var r; try { r = await sb.functions.invoke('admin-create-customer', { body: body }); } catch (e) { r = { error: e }; }
    if (btn) { btn.disabled = false; btn.textContent = 'Add customer'; }
    var errMsg = (r.error && r.error.message) || (r.data && r.data.error);
    if (errMsg) { if (msg) { msg.textContent = errMsg; msg.className = 'cd-crm-saved err'; } return; }
    var data = r.data || {};
    state.custNew = false;
    await loadCustomers();
    if (data.id) { state.selectedId = data.id; state.custEditing = null; renderCustRows(); renderCustDetail(); } else { renderCustDetail(); }
  }
  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
  /* no title typed: compose one from the route so dad never has to */
  function autoTitle(d) {
    var segs = d.segments || [];
    var f = segs[0] && segs[0].from && segs[0].from.city;
    var t = segs[0] && segs[0].to && segs[0].to.city;
    var cab = segs[0] && segs[0].cabin;
    if (f && t) return [f + ' to ' + t, cab].filter(Boolean).join(', ');
    return d.destination || 'Bespoke journey';
  }
  function custStat(label, value) { return h('div', { class: 'cd-stat' }, [h('div', { class: 'cd-stat-v', text: value }), h('div', { class: 'cd-stat-k', text: label })]); }
  function histRow(type, number, x, amtKey) {
    var label = type === 'invoice' ? 'Invoice' : type === 'quote' ? 'Quote' : 'Itinerary';
    var amt = amtKey ? money(dnum(x[amtKey]), x.currency || 'USD') : '';
    var meta = [x.title || quoteRouteLabel(x) || x.destination || '', amt, cap(x.status)].filter(Boolean).join('  ·  ');
    var el = h('div', { class: 'cd-hist-row' }, [
      h('span', { class: 'cd-hist-type cd-ht-' + type, text: label }),
      h('div', { class: 'cd-hist-main' }, [h('div', { class: 'cd-hist-no', text: number || '—' }), meta ? h('div', { class: 'cd-hist-meta', text: meta }) : null]),
      h('div', { class: 'cd-hist-date', text: fmtDate(x.created_at) })
    ]);
    return { el: el, date: x.created_at || '' };
  }
  async function loadCustomerHistory(p) {
    if (!p || !p.email) { fillHistory(p, [], [], []); return; }
    var em = p.email;
    var res = await Promise.all([
      sb.from('invoices').select('invoice_number, title, segments, total_charged, comparable_total, currency, status, created_at').ilike('customer_email', em),
      sb.from('quotes').select('quote_number, title, segments, total_charged, comparable_total, currency, status, created_at').ilike('customer_email', em),
      sb.from('itineraries').select('itinerary_number, title, segments, destination, status, created_at').ilike('customer_email', em)
    ]);
    if (state.selectedId !== p.id) return;
    fillHistory(p, res[0].data || [], res[1].data || [], res[2].data || []);
  }
  function fillHistory(p, invoices, quotes, itins) {
    var billed = 0, saved = 0;
    invoices.forEach(function (inv) { var t = dnum(inv.total_charged); billed += t; var c = dnum(inv.comparable_total); if (c > t) saved += (c - t); });
    var cur = (invoices[0] && invoices[0].currency) || 'USD';
    var statsEl = document.getElementById('cd-stats');
    if (statsEl) {
      statsEl.textContent = '';
      statsEl.appendChild(custStat('Lifetime billed', money(billed, cur)));
      statsEl.appendChild(custStat('Total saved', money(saved, cur)));
      statsEl.appendChild(custStat('Bookings', String(invoices.length)));
    }
    var rows = [];
    invoices.forEach(function (x) { rows.push(histRow('invoice', x.invoice_number, x, 'total_charged')); });
    quotes.forEach(function (x) { rows.push(histRow('quote', x.quote_number, x, 'total_charged')); });
    itins.forEach(function (x) { rows.push(histRow('itinerary', x.itinerary_number, x, null)); });
    rows.sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    var histEl = document.getElementById('cd-history');
    if (histEl) {
      histEl.textContent = '';
      histEl.appendChild(h('h4', { text: 'History · ' + rows.length }));
      if (!rows.length) histEl.appendChild(h('div', { class: 'cd-hist-empty', text: 'No quotes, invoices or itineraries yet.' }));
      else histEl.appendChild(h('div', { class: 'cd-hist' }, rows.map(function (r) { return r.el; })));
    }
  }

  var TIERS = ['Standard', 'VIP', 'Gold', 'Platinum', 'Black'];
  async function loadCustomerCRM(p) {
    if (!p) return;
    var r = await sb.from('customer_crm').select('*').eq('customer_id', p.id).maybeSingle();
    if (state.selectedId !== p.id) return;
    var box = document.getElementById('cd-crm'); if (!box) return;
    box.textContent = '';
    box.appendChild(crmForm(p, r.data || {}));
  }
  function crmForm(p, c) {
    var wrap = h('div');
    wrap.appendChild(h('div', { class: 'cd-crm-head' }, [h('h4', { text: 'Concierge notes' }), h('span', { class: 'cd-crm-tag', text: 'Internal — the customer never sees this' })]));
    wrap.appendChild(h('div', { class: 'inv-row2' }, [invField('Company', 'crm-company', 'text', '', c.company), invField('Industry', 'crm-industry', 'text', '', c.industry)]));
    wrap.appendChild(h('div', { class: 'inv-row2' }, [
      h('label', { class: 'inv-field' }, [h('span', { text: 'Loyalty tier' }), styledSelect('crm-tier', c.loyalty_tier || 'Standard', TIERS, null)]),
      invField('Preferred language', 'crm-language', 'text', '', c.language)
    ]));
    wrap.appendChild(h('div', { class: 'inv-row2' }, [invField('Dietary / cultural', 'crm-dietary', 'text', 'e.g. Halal, no shellfish', c.dietary), invField('Important dates', 'crm-occasions', 'text', 'e.g. Anniversary May 3', c.occasions)]));
    wrap.appendChild(h('label', { class: 'inv-field' }, [h('span', { text: 'Notes' }), h('textarea', { id: 'crm-notes', class: 'inv-input inv-textarea', rows: '4', placeholder: 'Anything useful for the next trip — preferences, history, who to thank…', value: c.notes || '' })]));
    wrap.appendChild(h('div', { class: 'cd-crm-foot' }, [
      h('button', { type: 'button', class: 'btn btn-primary', style: 'width:auto; padding:9px 20px', onclick: function (e) { saveCustomerCRM(p, e.target); }, text: 'Save notes' }),
      h('span', { id: 'crm-saved', class: 'cd-crm-saved' })
    ]));
    return wrap;
  }
  async function saveCustomerCRM(p, btn) {
    var saved = document.getElementById('crm-saved');
    var payload = { customer_id: p.id, company: val('crm-company') || null, industry: val('crm-industry') || null, loyalty_tier: val('crm-tier') || null, language: val('crm-language') || null, dietary: val('crm-dietary') || null, occasions: val('crm-occasions') || null, notes: val('crm-notes') || null, updated_at: new Date().toISOString() };
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    var r = await sb.from('customer_crm').upsert(payload).select().maybeSingle();
    if (btn) { btn.disabled = false; btn.textContent = 'Save notes'; }
    if (saved) { saved.textContent = r.error ? (r.error.message || 'Could not save') : 'Saved ✓'; saved.className = 'cd-crm-saved' + (r.error ? ' err' : ' ok'); }
  }

  /* ---------- invoices ---------- */
  var CURRENCIES = [
    { code: 'USD', name: 'US Dollar', sym: '$' }, { code: 'EUR', name: 'Euro', sym: '€' }, { code: 'GBP', name: 'British Pound', sym: '£' },
    { code: 'AED', name: 'UAE Dirham', sym: 'د.إ' }, { code: 'CAD', name: 'Canadian Dollar', sym: 'CA$' }, { code: 'AUD', name: 'Australian Dollar', sym: 'A$' },
    { code: 'CHF', name: 'Swiss Franc', sym: 'Fr' }, { code: 'SGD', name: 'Singapore Dollar', sym: 'S$' }, { code: 'JPY', name: 'Japanese Yen', sym: '¥' }
  ];
  var CABINS = ['First Class', 'Business Class', 'Premium Economy', 'Economy'];
  var AIRLINES = ['Emirates', 'Qatar Airways', 'Turkish Airlines', 'United Airlines', 'Delta Air Lines', 'American Airlines', 'Singapore Airlines', 'Etihad Airways', 'British Airways', 'Lufthansa', 'Air France', 'Cathay Pacific', 'ANA (All Nippon Airways)', 'Japan Airlines', 'Korean Air', 'KLM', 'SWISS', 'Virgin Atlantic', 'Qantas', 'Air Canada', 'EVA Air', 'Thai Airways', 'Saudia', 'Oman Air', 'Finnair', 'Iberia', 'Austrian Airlines', 'Aer Lingus', 'JetBlue', 'Hawaiian Airlines'];
  var AGENCY = { name: 'Upgrade Travel', tagline: 'First & Business Class, for less', phone: '+1 (713) 952-1010', email: 'info@flyupgrade.com', address: '' };
  async function loadSettings() {
    var r = await sb.from('app_settings').select('*').eq('id', 1).maybeSingle();
    state.settings = r.data || {};
    var s = state.settings;
    if (s.agency_name) AGENCY.name = s.agency_name;
    if (s.agency_tagline != null) AGENCY.tagline = s.agency_tagline;
    if (s.agency_phone != null) AGENCY.phone = s.agency_phone;
    if (s.agency_email != null) AGENCY.email = s.agency_email;
    AGENCY.address = s.agency_address || '';
  }
  function agencyHead() {
    return h('div', null, [h('div', { class: 'rev-agency', text: AGENCY.name }), h('div', { class: 'rev-agency-sub', text: AGENCY.tagline }), h('div', { class: 'rev-agency-contact', text: AGENCY.phone + '  ·  ' + AGENCY.email }), AGENCY.address ? h('div', { class: 'rev-agency-contact', text: AGENCY.address }) : null]);
  }
  function tabSettings() {
    var wrap = h('div');
    wrap.appendChild(mainHead('Settings', 'Your agency details, defaults and the fine print on documents.'));
    var body = h('div', { class: 'main-body' });
    if (state.settingsFlash) { body.appendChild(h('div', { class: 'msg ' + state.settingsFlash.kind, text: state.settingsFlash.text })); state.settingsFlash = null; }
    body.appendChild(settingsForm(state.settings || {}));
    wrap.appendChild(body);
    setTimeout(fillAppVersion, 0);
    return wrap;
  }
  function settingsForm(s) {
    var curOpts = CURRENCIES.map(function (c) { return { v: c.code, l: c.name, r: c.sym, b: c.code + '  ' + c.sym }; });
    return h('form', { class: 'inv-form', onsubmit: saveSettings }, [
      h('div', { class: 'inv-section' }, [
        h('h3', { class: 'inv-h3', text: 'Agency' }),
        h('p', { class: 'inv-sublabel', style: 'margin:-2px 0 14px', text: 'Shown at the top of every quote, invoice and itinerary.' }),
        h('div', { class: 'inv-row2' }, [invField('Agency name', 'set-name', 'text', '', s.agency_name), invField('Tagline', 'set-tagline', 'text', '', s.agency_tagline)]),
        h('div', { class: 'inv-row2' }, [invField('Phone', 'set-phone', 'text', '', s.agency_phone), invField('Email', 'set-email', 'text', '', s.agency_email)]),
        h('label', { class: 'inv-field' }, [h('span', { text: 'Address' }), h('textarea', { id: 'set-address', class: 'inv-input inv-textarea', rows: '2', value: s.agency_address || '' })])
      ]),
      h('div', { class: 'inv-section' }, [
        h('h3', { class: 'inv-h3', text: 'Getting paid' }),
        h('p', { class: 'inv-sublabel', style: 'margin:-2px 0 14px', text: 'Fill in every way you accept payment. On each invoice you pick which of these the customer sees.' }),
        h('label', { class: 'inv-field' }, [h('span', { text: 'Wire / bank transfer details' }), h('textarea', { id: 'set-payment', class: 'inv-input inv-textarea', rows: '3', placeholder: 'Bank name, account name, routing and account numbers, SWIFT…', value: s.payment_details || '' })]),
        h('div', { class: 'inv-row2' }, [invField('Stripe payment link', 'set-pay-stripe', 'text', 'https://buy.stripe.com/…', s.pay_stripe), invField('PayPal (link or email)', 'set-pay-paypal', 'text', 'paypal.me/… or you@email.com', s.pay_paypal)]),
        h('div', { class: 'inv-row2' }, [invField('Zelle (email or phone)', 'set-pay-zelle', 'text', '', s.pay_zelle), h('div')])
      ]),
      h('div', { class: 'inv-section' }, [
        h('h3', { class: 'inv-h3', text: 'Invoicing & terms' }),
        h('label', { class: 'inv-field' }, [h('span', { text: 'Invoice terms' }), h('textarea', { id: 'set-invterms', class: 'inv-input inv-textarea', rows: '2', placeholder: 'Leave blank to use the default wording.', value: s.invoice_terms || '' })]),
        h('label', { class: 'inv-field' }, [h('span', { text: 'Quote terms' }), h('textarea', { id: 'set-qterms', class: 'inv-input inv-textarea', rows: '2', placeholder: 'Leave blank to use the default wording.', value: s.quote_terms || '' })])
      ]),
      h('div', { class: 'inv-section' }, [
        h('h3', { class: 'inv-h3', text: 'Defaults' }),
        h('p', { class: 'inv-sublabel', style: 'margin:-2px 0 14px', text: 'Pre-filled when you start a new quote, invoice or itinerary.' }),
        h('div', { class: 'inv-row2' }, [
          h('label', { class: 'inv-field' }, [h('span', { text: 'Currency' }), styledSelect('set-currency', s.default_currency || 'USD', curOpts, null)]),
          h('label', { class: 'inv-field' }, [h('span', { text: 'Cabin' }), styledSelect('set-cabin', s.default_cabin || 'Business Class', CABINS, null)])
        ]),
        h('div', { class: 'inv-row2' }, [invField('Quote valid for (days)', 'set-validity', 'number', '14', s.quote_validity_days != null ? s.quote_validity_days : 14), invField('Default deposit (%)', 'set-deposit', 'number', '0', s.deposit_pct != null ? s.deposit_pct : 0)])
      ]),
      h('div', { class: 'inv-section' }, [
        h('h3', { class: 'inv-h3', text: 'App & updates' }),
        h('p', { class: 'inv-sublabel', style: 'margin:-2px 0 14px', text: 'The desktop app updates itself when a new version is released. You can also check now.' }),
        h('div', { class: 'set-ver-row' }, [
          h('div', { class: 'set-ver' }, [h('span', { class: 'set-ver-label', text: 'Version' }), h('span', { id: 'set-ver', class: 'set-ver-num', text: '…' })]),
          h('button', { type: 'button', id: 'set-update-btn', class: 'btn btn-ghost', style: 'width:auto', onclick: runUpdateCheck, text: 'Check for updates' })
        ]),
        h('div', { id: 'update-status', class: 'set-update-status', text: '' }),
        h('div', { id: 'upd-progress', class: 'upd-progress', hidden: true }, [h('div', { id: 'upd-progress-fill', class: 'upd-progress-fill' })]),
        h('button', { type: 'button', class: 'set-dl-link', onclick: function () { if (window.adminApp && window.adminApp.openReleases) window.adminApp.openReleases(); }, text: 'Open the download page' })
      ]),
      h('div', { class: 'inv-submit' }, [h('div', { id: 'set-msg', class: 'msg', style: 'display:none' }), h('button', { type: 'submit', class: 'btn btn-primary', style: 'width:auto; padding:13px 30px', text: 'Save settings' })])
    ]);
  }
  async function saveSettings(e) {
    e.preventDefault();
    var btn = e.target.querySelector('button[type=submit]'), m = document.getElementById('set-msg');
    var payload = {
      id: 1,
      agency_name: val('set-name') || null, agency_tagline: val('set-tagline') || null, agency_phone: val('set-phone') || null, agency_email: val('set-email') || null, agency_address: val('set-address') || null,
      payment_details: val('set-payment') || null, pay_stripe: val('set-pay-stripe') || null, pay_paypal: val('set-pay-paypal') || null, pay_zelle: val('set-pay-zelle') || null, invoice_terms: val('set-invterms') || null, quote_terms: val('set-qterms') || null,
      default_currency: val('set-currency') || 'USD', default_cabin: val('set-cabin') || 'Business Class',
      quote_validity_days: parseInt(val('set-validity'), 10) || 14, deposit_pct: parseFloat(val('set-deposit')) || 0,
      updated_at: new Date().toISOString()
    };
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    var r = await sb.from('app_settings').upsert(payload).select().maybeSingle();
    if (btn) { btn.disabled = false; btn.textContent = 'Save settings'; }
    if (r.error) { if (m) { m.textContent = r.error.message || 'Could not save.'; m.className = 'msg err'; m.style.display = ''; } return; }
    await loadSettings();
    state.settingsFlash = { kind: 'ok', text: 'Settings saved. They now appear on new documents.' };
    renderTab();
  }


  function closeAllSS() { Array.prototype.forEach.call(document.querySelectorAll('.ss.is-open'), function (s) { s.classList.remove('is-open'); }); }
  function styledSelect(id, value, opts, onChange) {
    if (!styledSelect._init) { styledSelect._init = true; document.addEventListener('click', function (e) { if (!e.target.closest('.ss')) closeAllSS(); }); }
    var wrap = h('div', { class: 'ss' });
    var hidden = h('input', { type: 'hidden', id: id, value: value || '' });
    function btnText(o) { return o ? (o.b != null ? o.b : (o.l != null ? o.l : o)) : ''; }
    var curOpt = opts.filter(function (o) { return (o.v != null ? o.v : o) === value; })[0] || opts[0];
    var valSpan = h('span', { class: 'ss-val', text: btnText(curOpt) });
    var btn = h('button', { type: 'button', class: 'ss-btn' }, [valSpan, h('span', { class: 'ss-chev' })]);
    btn.addEventListener('click', function (e) { e.preventDefault(); var open = wrap.classList.contains('is-open'); closeAllSS(); if (!open) wrap.classList.add('is-open'); });
    var list = h('div', { class: 'ss-list' }, opts.map(function (o) {
      var v = o.v != null ? o.v : o, l = o.l != null ? o.l : o;
      var item = (o.r != null)
        ? h('div', { class: 'ss-opt ss-opt--2' + (v === value ? ' is-sel' : '') }, [h('span', { class: 'ss-opt-l', text: l }), h('span', { class: 'ss-opt-r', text: o.r })])
        : h('div', { class: 'ss-opt' + (v === value ? ' is-sel' : ''), text: l });
      item.addEventListener('mousedown', function (e) { e.preventDefault(); hidden.value = v; valSpan.textContent = btnText(o); Array.prototype.forEach.call(list.children, function (c) { c.classList.toggle('is-sel', c === item); }); closeAllSS(); if (onChange) onChange(v); });
      return item;
    }));
    wrap.appendChild(hidden); wrap.appendChild(btn); wrap.appendChild(list);
    return wrap;
  }
  function paxField(label, id, value) { return h('label', { class: 'inv-field' }, [h('span', { text: label }), h('input', { id: id, class: 'inv-input', type: 'number', min: '0', step: '1', value: value })]); }
  function paxLabel(d) { var p = [], a = d.pax_adults || 0, c = d.pax_children || 0, i = d.pax_infants || 0; if (a) p.push(a + ' adult' + (a > 1 ? 's' : '')); if (c) p.push(c + ' child' + (c > 1 ? 'ren' : '')); if (i) p.push(i + ' infant' + (i > 1 ? 's' : '')); return p.join(' · ') || (d.passengers || 1) + ' passenger'; }

  function searchAirports(q) {
    q = (q || '').trim().toLowerCase(); if (q.length < 2) return [];
    var A = window.UT_AIRPORTS || [], res = [];
    for (var i = 0; i < A.length; i++) {
      var a = A[i], code = a[0].toLowerCase(), city = a[1].toLowerCase(), name = (a[3] || '').toLowerCase(), s = -1;
      if (code === q) s = 0; else if (code.indexOf(q) === 0) s = 1; else if (city.indexOf(q) === 0) s = 2; else if (city.indexOf(q) > -1) s = 3; else if (name.indexOf(q) > -1) s = 4;
      if (s > -1) res.push([s, a]);
    }
    res.sort(function (x, y) { return x[0] - y[0]; });
    return res.slice(0, 8).map(function (r) { return r[1]; });
  }
  function airportInput(sel) {
    var wrap = h('div', { class: 'ap-wrap' });
    var input = h('input', { class: 'inv-input ap-input', type: 'text', placeholder: 'City or airport code', autocomplete: 'off', value: sel ? (sel.code + ' — ' + sel.city) : '' });
    var menu = h('div', { class: 'ap-menu', style: 'display:none' });
    wrap._selected = sel || null;
    input.addEventListener('input', function () {
      wrap._selected = null; menu.textContent = '';
      var rs = searchAirports(input.value);
      if (!rs.length) { menu.style.display = 'none'; return; }
      rs.forEach(function (a) {
        var opt = h('div', { class: 'ap-opt' }, [h('b', { class: 'ap-code', text: a[0] }), h('span', { class: 'ap-city', text: a[1] + ', ' + a[2] }), h('span', { class: 'ap-name', text: a[3] })]);
        opt.addEventListener('mousedown', function (e) { e.preventDefault(); wrap._selected = { code: a[0], city: a[1], country: a[2], name: a[3] }; input.value = a[0] + ' — ' + a[1]; menu.style.display = 'none'; });
        menu.appendChild(opt);
      });
      menu.style.display = 'block';
    });
    input.addEventListener('blur', function () { setTimeout(function () { menu.style.display = 'none'; }, 160); });
    wrap.appendChild(input); wrap.appendChild(menu); return wrap;
  }
  function airlineInput(value) {
    var wrap = h('div', { class: 'al-wrap' });
    var input = h('input', { class: 'inv-input seg-airline', type: 'text', placeholder: 'e.g. Emirates', autocomplete: 'off', value: value || '' });
    var menu = h('div', { class: 'al-menu', style: 'display:none' });
    function show(list) {
      menu.textContent = '';
      if (!list.length) { menu.style.display = 'none'; return; }
      list.forEach(function (a) {
        var opt = h('div', { class: 'al-opt', text: a });
        opt.addEventListener('mousedown', function (e) { e.preventDefault(); input.value = a; menu.style.display = 'none'; });
        menu.appendChild(opt);
      });
      menu.style.display = 'block';
    }
    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase(), nq = q.replace(/\s+/g, '');
      if (!q) { show(AIRLINES.slice(0, 8)); return; }
      var ms = AIRLINES.filter(function (a) { var la = a.toLowerCase(); return la.indexOf(q) > -1 || la.replace(/\s+/g, '').indexOf(nq) > -1; });
      ms.sort(function (a, b) { return (b.toLowerCase().indexOf(q) === 0 ? 1 : 0) - (a.toLowerCase().indexOf(q) === 0 ? 1 : 0); });
      show(ms.slice(0, 8));
    });
    input.addEventListener('focus', function () { if (!input.value.trim()) show(AIRLINES.slice(0, 8)); });
    input.addEventListener('blur', function () { setTimeout(function () { menu.style.display = 'none'; }, 160); });
    wrap.appendChild(input); wrap.appendChild(menu); return wrap;
  }
  function toHHMM(t) { if (!t) return ''; var m = ('' + t).match(/(\d{1,2}):(\d{2})/); if (!m) return ''; return (m[1].length === 1 ? '0' + m[1] : m[1]) + ':' + m[2]; }
  /* ---- layover / connection helpers (itinerary + package builders) ---- */
  function fmtDurMins(mins) { if (!(mins > 0)) return ''; var hh = Math.floor(mins / 60), mm = mins % 60; return ((hh ? hh + 'h' : '') + (hh && mm ? ' ' : '') + (mm ? mm + 'm' : '')) || '0m'; }
  function prevSegCard(card) { var cards = Array.prototype.slice.call(document.querySelectorAll('#inv-segs .seg-card')); var i = cards.indexOf(card); return i > 0 ? cards[i - 1] : null; }
  /* a leg's arrival datetime — rolls to next day when the arrival clock is earlier than departure */
  function segArriveDT(card) {
    var dD = (card.querySelector('.seg-date') || {}).value || '', dT = (card.querySelector('.seg-deptime') || {}).value || '', aT = (card.querySelector('.seg-arrtime') || {}).value || '';
    if (!dD || !aT) return null;
    var arrDate = dD;
    if (dT && aT < dT) { var d = new Date(dD + 'T00:00:00'); d.setDate(d.getDate() + 1); arrDate = d.toISOString().slice(0, 10); }
    return arrDate + 'T' + aT + ':00';
  }
  function segLayoverMins(card) {
    var prev = prevSegCard(card); if (!prev) return 0;
    var pa = segArriveDT(prev), dD = (card.querySelector('.seg-date') || {}).value || '', dT = (card.querySelector('.seg-deptime') || {}).value || '';
    if (!pa || !dD || !dT) return 0;
    var mins = Math.round((new Date(dD + 'T' + dT + ':00') - new Date(pa)) / 60000);
    return (mins > 0 && mins <= 2880) ? mins : 0;
  }
  function setSegKind(card, kind) {
    var hid = card.querySelector('.seg-layover-kind'); if (hid) hid.value = kind;
    Array.prototype.forEach.call(card.querySelectorAll('.seg-kind-btn'), function (b) { b.classList.toggle('is-active', b.getAttribute('data-kind') === kind); });
  }
  /* fill the ground-time placeholder + value from the surrounding flight times, and pick a sensible kind */
  function autoLayover(card) {
    var mins = segLayoverMins(card), durEl = card.querySelector('.seg-layover-dur');
    if (durEl) { var s = fmtDurMins(mins); if (s) { durEl.placeholder = s + ' on the ground'; if (!(durEl.value || '').trim()) durEl.value = s; } }
    var kindEl = card.querySelector('.seg-layover-kind');
    if (kindEl && !(kindEl.value || '').trim() && mins) setSegKind(card, mins < 180 ? 'connection' : 'layover');
  }
  function segKindControl(kind) {
    function kb(k, label) { var b = h('button', { type: 'button', class: 'seg-kind-btn' + (kind === k ? ' is-active' : ''), 'data-kind': k, text: label }); b.addEventListener('click', function () { setSegKind(b.closest('.seg-card'), k); }); return b; }
    return h('div', { class: 'seg-kind' }, [h('input', { type: 'hidden', class: 'seg-layover-kind', value: kind || '' }), kb('connection', 'Quick connection'), kb('layover', 'Long layover')]);
  }
  function layoverWord(s) { return s && s.layover_kind === 'connection' ? 'Quick connection' : 'Layover'; }
  function layoverLabel(s) { return [layoverWord(s), s && s.layover_duration].filter(Boolean).join('  ·  '); }
  /* structured traveler entry: Title + First + Last + Type rows. A hidden field keeps the
     joined "Mr Ahmed Loya" lines (so everything downstream keeps working) and the counts
     auto-fill the adults/children/infants numbers. */
  var NAME_TITLES = ['Mr', 'Mrs', 'Ms', 'Miss', 'Master', 'Dr'];
  var PAX_TYPES = ['Adult', 'Child', 'Infant'];
  function parseTravelerLine(line) {
    line = (line || '').trim(); if (!line) return null;
    var t = { title: 'Mr', first: '', last: '', type: 'Adult' };
    var parts = line.split(/\s+/);
    var first = (parts[0] || '').replace(/\.$/, ''), match = null;
    NAME_TITLES.forEach(function (x) { if (x.toLowerCase() === first.toLowerCase()) match = x; });
    if (match) { t.title = match; parts.shift(); if (match === 'Master') t.type = 'Child'; }
    t.first = parts.shift() || '';
    t.last = parts.join(' ');
    return (t.first || t.last) ? t : null;
  }
  function travelerRows(opts) {
    opts = opts || {};
    var hiddenAttrs = { type: 'hidden', value: opts.value || '' };
    if (opts.id) hiddenAttrs.id = opts.id;
    if (opts.cls) hiddenAttrs.class = opts.cls;
    var hidden = h('input', hiddenAttrs);
    var rows = h('div', { class: 'trav-rows' });
    var wrap;
    function sync() {
      var names = [], counts = { Adult: 0, Child: 0, Infant: 0 };
      Array.prototype.forEach.call(rows.querySelectorAll('.trav-row'), function (r) {
        var title = (r.querySelector('.trav-title .ss input[type=hidden]') || {}).value || '';
        var fn = ((r.querySelector('.trav-first') || {}).value || '').trim();
        var ln = ((r.querySelector('.trav-last') || {}).value || '').trim();
        var type = (r.querySelector('.trav-type .ss input[type=hidden]') || {}).value || 'Adult';
        if (!fn && !ln) return;
        names.push([title, fn, ln].filter(Boolean).join(' '));
        counts[type] = (counts[type] || 0) + 1;
      });
      hidden.value = names.join('\n');
      if (opts.onChange) opts.onChange(counts, names.length, wrap);
    }
    function addRow(t) {
      t = t || { title: 'Mr', first: '', last: '', type: 'Adult' };
      var rm = h('button', { type: 'button', class: 'bag-rm', title: 'Remove traveler', text: '\u00d7' });
      var row = h('div', { class: 'trav-row' }, [
        h('div', { class: 'trav-title' }, [styledSelect(null, t.title, NAME_TITLES, sync)]),
        h('input', { class: 'inv-input trav-first', type: 'text', placeholder: 'First name', autocomplete: 'off', value: t.first || '' }),
        h('input', { class: 'inv-input trav-last', type: 'text', placeholder: 'Last name', autocomplete: 'off', value: t.last || '' }),
        h('div', { class: 'trav-type' }, [styledSelect(null, t.type, PAX_TYPES, sync)]),
        rm
      ]);
      row.addEventListener('input', sync);
      rm.addEventListener('click', function () { row.remove(); sync(); });
      rows.appendChild(row);
    }
    ('' + (opts.value || '')).split(/\n|,/).map(parseTravelerLine).filter(Boolean).forEach(addRow);
    if (!rows.children.length) addRow(opts.seed || null);
    wrap = h('div', { class: 'trav-wrap' }, [
      hidden,
      h('div', { class: 'trav-head' }, [h('span', { text: 'Title' }), h('span', { text: 'First name' }), h('span', { text: 'Last name' }), h('span', { text: 'Type' }), h('span')]),
      rows,
      h('button', { type: 'button', class: 'inv-addline', onclick: function () { addRow(); }, text: '+ Add traveler' })
    ]);
    return wrap;
  }
  /* seats as separable chips: type a seat (e.g. 2A), press Enter -> its own tag. Stores an array. */
  function seatList(v) { if (Array.isArray(v)) return v.filter(Boolean); return (v || '').split(/[\s,·\/]+/).map(function (s) { return s.trim(); }).filter(Boolean); }
  function seatChips(value) {
    var box = h('div', { class: 'seat-box' });
    var input = h('input', { class: 'seat-input', type: 'text', placeholder: 'type a seat, press Enter', autocomplete: 'off' });
    function addChip(v) {
      v = (v || '').trim().toUpperCase(); if (!v) return;
      var chip = h('span', { class: 'seat-chip', 'data-seat': v }, [h('span', { text: v }), h('button', { type: 'button', class: 'seat-chip-x', title: 'Remove', onclick: function () { chip.remove(); }, text: '×' })]);
      box.insertBefore(chip, input);
    }
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addChip(input.value); input.value = ''; }
      else if (e.key === 'Backspace' && !input.value) { var last = box.querySelector('.seat-chip:last-of-type'); if (last) last.remove(); }
    });
    input.addEventListener('blur', function () { if (input.value.trim()) { addChip(input.value); input.value = ''; } });
    box.appendChild(input); /* input must be in the box BEFORE seeding chips: insertBefore needs it */
    seatList(value).forEach(addChip);
    box.addEventListener('click', function () { input.focus(); });
    return h('label', { class: 'inv-field seg-seats-wrap' }, [h('span', { text: 'Seats' }), box]);
  }
  /* structured baggage: rows of Type (dropdown) + Qty + Weight + Unit (kg/lb). Stores an array. */
  var BAG_TYPES = ['Carry-on', 'Personal item', 'Checked bag', 'Extra checked bag', 'Sports equipment', 'Oversized item'];
  var BAG_UNITS = ['kg', 'lb'];
  function bagList(v) { return Array.isArray(v) ? v.filter(function (b) { return b && (b.type || b.weight != null); }) : []; }
  function bagRowEl(item) {
    item = item || {};
    var rm = h('button', { type: 'button', class: 'bag-rm', title: 'Remove', text: '×' });
    var row = h('div', { class: 'bag-row' }, [
      h('div', { class: 'bag-c bag-type' }, [styledSelect(null, item.type || 'Checked bag', BAG_TYPES, null)]),
      h('div', { class: 'bag-c bag-qty' }, [h('input', { class: 'inv-input', type: 'number', min: '1', step: '1', value: item.qty != null ? item.qty : 1 })]),
      h('div', { class: 'bag-c bag-wt' }, [h('input', { class: 'inv-input', type: 'number', min: '0', step: '1', placeholder: 'Weight', value: item.weight != null ? item.weight : '' })]),
      h('div', { class: 'bag-c bag-unit' }, [styledSelect(null, item.unit || 'kg', BAG_UNITS, null)]),
      rm
    ]);
    rm.addEventListener('click', function () { row.remove(); });
    return row;
  }
  /* the typical allowance for a cabin, one tap instead of four fields */
  function standardBags(cabin) {
    var c = (cabin || '').toLowerCase();
    if (c.indexOf('first') > -1 || c.indexOf('business') > -1) return [{ type: 'Checked bag', qty: 2, weight: 32, unit: 'kg' }, { type: 'Carry-on', qty: 1, weight: 8, unit: 'kg' }];
    if (c.indexOf('premium') > -1) return [{ type: 'Checked bag', qty: 2, weight: 23, unit: 'kg' }, { type: 'Carry-on', qty: 1, weight: 8, unit: 'kg' }];
    return [{ type: 'Checked bag', qty: 1, weight: 23, unit: 'kg' }, { type: 'Carry-on', qty: 1, weight: 8, unit: 'kg' }];
  }
  function baggageBuilder(value) {
    var rows = h('div', { class: 'bag-rows' });
    function addRow(item) { rows.appendChild(bagRowEl(item)); }
    bagList(value).forEach(addRow);
    var legacy = (typeof value === 'string' && value.trim()) ? value.trim() : '';
    return h('div', { class: 'inv-field bag-wrap' }, [
      h('span', { text: 'Baggage allowance' }),
      legacy ? h('p', { class: 'bag-legacy', text: 'Currently: “' + legacy + '” — kept as-is unless you add rows below.' }) : null,
      legacy ? h('input', { type: 'hidden', class: 'bag-legacy-keep', value: legacy }) : null,
      h('div', { class: 'bag-head' }, [h('span', { text: 'Type' }), h('span', { text: 'Qty' }), h('span', { text: 'Weight' }), h('span', { text: 'Unit' }), h('span')]),
      rows,
      h('div', { class: 'bag-btns' }, [
        h('button', { type: 'button', class: 'inv-addline bag-add', onclick: function () { addRow(); }, text: '+ Add baggage' }),
        h('button', { type: 'button', class: 'inv-addline', title: 'Fill the usual allowance for this leg\u2019s cabin', onclick: function (e) {
          var card = e.target.closest('.seg-card'); var cabin = card ? ((card.querySelector('.ss input[type=hidden]') || {}).value || '') : '';
          rows.textContent = '';
          standardBags(cabin).forEach(addRow);
        }, text: 'Standard for this cabin' }),
        h('button', { type: 'button', class: 'inv-addline', title: 'Copy this leg\u2019s baggage to every flight in this list', onclick: function (e) {
          var card = e.target.closest('.seg-card'); if (!card) return;
          var bags = readBaggage(card), list = card.closest('.inv-segs'); if (!bags.length || !list) return;
          Array.prototype.forEach.call(list.querySelectorAll('.seg-card'), function (other) {
            if (other === card) return;
            var r2 = other.querySelector('.bag-wrap .bag-rows'); if (!r2) return;
            r2.textContent = '';
            bags.forEach(function (b) { r2.appendChild(bagRowEl(b)); });
          });
          e.target.textContent = 'Copied to all \u2713'; setTimeout(function () { e.target.textContent = 'Copy to all flights'; }, 1600);
        }, text: 'Copy to all flights' })
      ])
    ]);
  }
  function readBaggage(card) {
    var out = [];
    Array.prototype.forEach.call(card.querySelectorAll('.bag-wrap .bag-row'), function (row) {
      var type = (row.querySelector('.bag-type .ss input[type=hidden]') || {}).value || '';
      var qty = parseInt((row.querySelector('.bag-qty input') || {}).value, 10); if (isNaN(qty) || qty < 1) qty = 1;
      var wt = parseFloat((row.querySelector('.bag-wt input') || {}).value);
      var unit = (row.querySelector('.bag-unit .ss input[type=hidden]') || {}).value || 'kg';
      if (!type && isNaN(wt)) return;
      var b = { type: type || 'Checked bag', qty: qty, unit: unit };
      if (!isNaN(wt)) b.weight = wt;
      out.push(b);
    });
    return out;
  }
  function bookedCtx() { return state.builderTab === 'itinerary' || state.pkgBuilding || state.gtBuilding; }
  function segRow(seg) {
    var cabinVal = (seg && seg.cabin) || (state.settings && state.settings.default_cabin) || 'Business Class';
    var rich = state.builderTab === 'itinerary' || state.pkgBuilding || state.gtBuilding;
    function richField(label, cls, v, ph) { return h('label', { class: 'inv-field' }, [h('span', { text: label }), h('input', { class: 'inv-input ' + cls, type: 'text', autocomplete: 'off', placeholder: ph || '', value: v || '' })]); }
    return h('div', { class: 'seg-card' }, [
      h('div', { class: 'seg-role-row' }, [
        h('span', { class: 'seg-role', text: 'Flight' }),
        h('button', { type: 'button', class: 'seg-card-rm', title: 'Remove flight', onclick: function (e) { var list = e.target.closest('.inv-segs'); if (list && list.querySelectorAll('.seg-card').length > 1) { e.target.closest('.seg-card').remove(); renumberLegs(list); } }, text: '×' })
      ]),
      h('input', { type: 'hidden', class: 'seg-aircraft', value: (seg && seg.aircraft) || '' }),
      h('input', { type: 'hidden', class: 'seg-duration', value: (seg && seg.duration) || '' }),
      h('input', { type: 'hidden', class: 'seg-distance', value: (seg && seg.distance_km) || '' }),
      h('div', { class: 'seg-lookup-row' }, [
        h('label', { class: 'inv-field' }, [h('span', { text: 'Flight number' }), h('input', { class: 'inv-input seg-flightno', type: 'text', placeholder: 'e.g. EK212', autocomplete: 'off', value: (seg && seg.flight_number) || '' })]),
        h('div', { class: 'inv-field' }, [h('span', { class: 'seg-lookup-spacer', text: 'x' }), h('button', { type: 'button', class: 'btn btn-primary seg-lookup-btn', style: 'width:auto; height:46px; padding:0 20px', onclick: function (e) { lookupFlight(e.target.closest('.seg-card')); }, text: 'Look up' })])
      ]),
      h('div', { class: 'seg-lookup-status' }),
      h('div', { class: 'inv-row2' }, [
        h('label', { class: 'inv-field' }, [h('span', { text: 'Airline' }), airlineInput(seg && seg.airline)]),
        h('label', { class: 'inv-field' }, [h('span', { text: 'Cabin' }), styledSelect(null, cabinVal, CABINS, null)])
      ]),
      h('div', { class: 'seg-route-row' }, [airportInput(seg && seg.from), h('span', { class: 'seg-arrow', text: '→' }), airportInput(seg && seg.to)]),
      h('div', { class: 'inv-row3', style: 'margin-top:12px' }, [
        h('label', { class: 'inv-field' }, [h('span', { text: 'Date' }), h('input', { class: 'inv-input seg-date', type: 'date', value: (seg && seg.depart_date) || '' })]),
        h('label', { class: 'inv-field' }, [h('span', { text: 'Departs' }), h('input', { class: 'inv-input seg-deptime', type: 'time', value: toHHMM(seg && seg.depart_time) })]),
        h('label', { class: 'inv-field' }, [h('span', { text: 'Arrives' }), h('input', { class: 'inv-input seg-arrtime', type: 'time', value: toHHMM(seg && seg.arrive_time) })])
      ]),
      rich ? h('div', { class: 'seg-rich' }, [
        h('label', { class: 'seg-connect' }, [
          h('input', { type: 'checkbox', class: 'seg-connect-cb', checked: !!(seg && seg.connect_from_prev), onchange: function (e) { var card = e.target.closest('.seg-card'); var w = card.querySelector('.seg-layover-wrap'); if (w) w.hidden = !e.target.checked; if (e.target.checked) autoLayover(card); } }),
          h('span', { text: 'This is a connecting flight — it continues from the flight above' })
        ]),
        h('div', { class: 'seg-layover-wrap', hidden: !(seg && seg.connect_from_prev) }, [
          h('div', { class: 'seg-layover-panel' }, [
            h('span', { class: 'seg-layover-h', text: 'The stop before this flight' }),
            h('p', { class: 'seg-layover-hint', text: 'Is it a quick connection or a proper layover? Pick one, and we’ll show it on the trip.' }),
            segKindControl((seg && seg.layover_kind) || ''),
            h('div', { class: 'inv-row2', style: 'margin-top:14px' }, [
              h('label', { class: 'inv-field' }, [h('span', { text: 'Time on the ground' }), h('input', { class: 'inv-input seg-layover-dur', type: 'text', autocomplete: 'off', placeholder: 'e.g. 2h 15m (auto from times)', value: (seg && seg.layover_duration) || '' })]),
              richField('Layover note (optional)', 'seg-layover-note', seg && seg.layover_note, 'e.g. Change of terminal · lounge access · long enough to leave the airport')
            ])
          ])
        ]),
        h('div', { class: 'inv-row2', style: 'margin-top:12px' }, [
          h('label', { class: 'inv-field' }, [h('span', { text: 'Confirmation / PNR' }), h('div', { class: 'itin-pull-row' }, [
            h('input', { class: 'inv-input seg-conf', type: 'text', autocomplete: 'off', placeholder: 'Booking reference', value: (seg && seg.confirmation) || '' }),
            h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto; padding:0 12px; height:46px; white-space:nowrap', title: 'Same booking reference on every flight in this list', onclick: function (e) {
              var card = e.target.closest('.seg-card'); var v = card ? ((card.querySelector('.seg-conf') || {}).value || '').trim() : '';
              var list = card && card.closest('.inv-segs'); if (!v || !list) return;
              Array.prototype.forEach.call(list.querySelectorAll('.seg-card .seg-conf'), function (inp) { inp.value = v; });
              e.target.textContent = '\u2713'; setTimeout(function () { e.target.textContent = '\u2192 all'; }, 1600);
            }, text: '\u2192 all' })
          ])]),
          richField('Operated by \u2014 ONLY if a different airline flies it', 'seg-opby', seg && seg.operated_by, 'Leave blank unless codeshare')
        ]),
        h('div', { class: 'inv-row2', style: 'margin-top:12px' }, [
          h('label', { class: 'inv-field' }, [h('span', { text: 'Arrival date — only if it lands a different day' }), h('input', { class: 'inv-input seg-arrdate', type: 'date', value: (seg && seg.arrive_date) || '' })]),
          richField('E-ticket numbers', 'seg-etkt', seg && seg.eticket, 'e.g. 235-1234567890 · 235-1234567891')
        ]),
        h('div', { class: 'inv-row3', style: 'margin-top:12px' }, [
          richField('Dep. terminal', 'seg-depterm', seg && seg.dep_terminal, 'e.g. 3'),
          richField('Arr. terminal', 'seg-arrterm', seg && seg.arr_terminal, 'e.g. 2'),
          seatChips(seg && seg.seats)
        ]),
        baggageBuilder(seg && seg.baggage),
        richField('Flight notes (optional)', 'seg-notes', seg && seg.notes, 'Specific to this flight')
      ]) : null
    ]);
  }
  var TRIP_TYPES = [['round', 'Round trip'], ['one_way', 'One way'], ['multi', 'Multi-city']];
  function detectTripType(d) {
    if (d && d.trip_type) return d.trip_type;
    var segs = (d && d.segments) || [];
    if (segs.length >= 3) return 'multi';
    if (segs.length === 2) return 'round';
    if (segs.length === 1 && segs[0] && segs[0].return_date) return 'round';
    return segs.length >= 1 ? 'one_way' : 'round';
  }
  function tripTypeControl(active) {
    active = active || 'round';
    return h('div', { class: 'trip-type-ctl' }, [h('input', { type: 'hidden', id: 'trip-type', value: active })].concat(TRIP_TYPES.map(function (t) {
      return h('button', { type: 'button', class: 'tt-btn' + (t[0] === active ? ' is-active' : ''), 'data-tt': t[0], onclick: function () { selectTripType(t[0]); }, text: t[1] });
    })));
  }
  function readTripType() { return (document.getElementById('trip-type') || {}).value || null; }
  function selectTripType(type) {
    var hid = document.getElementById('trip-type'); if (hid) hid.value = type;
    Array.prototype.forEach.call(document.querySelectorAll('.tt-btn'), function (b) { b.classList.toggle('is-active', b.getAttribute('data-tt') === type); });
    applyTripType(type);
  }
  function reversedLeg(card) {
    var w = card.querySelectorAll('.ap-wrap'), f = w[0] && w[0]._selected, t = w[1] && w[1]._selected, cab = card.querySelector('.ss input[type=hidden]');
    return segRow({ from: t || null, to: f || null, cabin: cab ? cab.value : null, airline: (card.querySelector('.seg-airline') || {}).value || null });
  }
  function applyTripType(type) {
    var c = document.getElementById('inv-segs'); if (!c) return;
    var cards = c.querySelectorAll('.seg-card');
    if (type === 'round' && cards.length === 1) c.appendChild(reversedLeg(cards[0]));
    else if (type === 'one_way') {
      for (var i = cards.length - 1; i >= 1; i--) {
        var w = cards[i].querySelectorAll('.ap-wrap');
        var empty = !(w[0] && w[0]._selected) && !(w[1] && w[1]._selected) && !((cards[i].querySelector('.seg-flightno') || {}).value || '').trim();
        if (empty) cards[i].remove(); else break;
      }
    }
    relabelSegs(); initDatePickers(c);
  }
  /* renumber flight cards inside one list; the global builder list keeps its richer labels */
  function renumberLegs(list) {
    if (!list) return;
    if (list.id === 'inv-segs') { relabelSegs(); return; }
    var cards = list.querySelectorAll('.seg-card');
    Array.prototype.forEach.call(cards, function (c, i) { var r = c.querySelector('.seg-role'); if (r) r.textContent = cards.length > 1 ? 'Flight ' + (i + 1) : 'Flight'; });
  }
  function relabelSegs() {
    var typeEl = document.getElementById('trip-type');
    var cards = document.querySelectorAll('#inv-segs .seg-card');
    var add = document.getElementById('inv-add-flight');
    if (!typeEl) { /* plain sequential list (group trips) — just number the flights */
      if (add) add.textContent = '+ Add flight';
      Array.prototype.forEach.call(cards, function (card, i) { var role = card.querySelector('.seg-role'); if (role) role.textContent = cards.length > 1 ? 'Flight ' + (i + 1) : 'Flight'; });
      return;
    }
    var type = typeEl.value || 'round';
    var addRet = document.getElementById('inv-add-return');
    if (add) add.textContent = type === 'round' ? '+ Add another flight (make it multi-city)' : '+ Add flight';
    if (addRet) addRet.style.display = (type === 'multi') ? '' : 'none';
    Array.prototype.forEach.call(cards, function (card, i) {
      var role = card.querySelector('.seg-role'), label;
      if (type === 'round') label = i === 0 ? 'Outbound flight' : ((i === cards.length - 1 && cards.length > 1) ? 'Return flight' : 'Flight ' + (i + 1));
      else if (type === 'one_way') label = cards.length > 1 ? 'Flight ' + (i + 1) : 'Flight details';
      else label = 'Flight ' + (i + 1);
      if (role) role.textContent = label;
    });
  }
  function flightsSection(segs, tripType, opts) {
    var plain = !!(opts && opts.plain); /* group trips: no round/one-way/multi control, just a flight list */
    var kids = [];
    if (!plain) kids.push(tripTypeControl(tripType));
    /* a round trip is always outbound + return, so open both rows by default */
    if (!plain && (tripType || 'round') === 'round' && segs.length < 2) segs = [segs[0] || null, null];
    kids.push(h('div', { id: 'inv-segs', class: 'inv-segs' }, segs.map(segRow)));
    if (plain) {
      kids.push(h('button', { type: 'button', id: 'inv-add-flight', class: 'inv-addline', onclick: function () { var r = segRow(); document.getElementById('inv-segs').appendChild(r); relabelSegs(); initDatePickers(r); }, text: '+ Add flight' }));
    } else {
      kids.push(h('div', { class: 'flight-add-row' }, [
        h('button', { type: 'button', id: 'inv-add-flight', class: 'inv-addline', onclick: function () { addFlight(false); }, text: '+ Add flight' }),
        h('button', { type: 'button', id: 'inv-add-return', class: 'inv-addline', style: 'display:none', onclick: function () { addFlight(true); }, text: '+ Add return flight' })
      ]));
    }
    return h('div', { class: 'flights-wrap' }, kids);
  }
  /* outbound stays first, return stays last: a mid-trip add lands before the return leg */
  function addFlight(isReturn) {
    var list = document.getElementById('inv-segs'); if (!list) return;
    var type = (document.getElementById('trip-type') || {}).value || '';
    var cards = list.querySelectorAll('.seg-card'), r;
    if (isReturn) { r = returnLegFromList(list); list.appendChild(r); }
    else if (type === 'round' && cards.length >= 2) { r = segRow(); list.insertBefore(r, cards[cards.length - 1]); }
    else { r = segRow(); list.appendChild(r); }
    relabelSegs(); initDatePickers(r);
  }
  function returnLegFromList(list) {
    var cards = list.querySelectorAll('.seg-card');
    if (!cards.length) return segRow();
    var first = cards[0], last = cards[cards.length - 1];
    var lw = last.querySelectorAll('.ap-wrap'), fw = first.querySelectorAll('.ap-wrap');
    var to = lw[1] && lw[1]._selected, from = fw[0] && fw[0]._selected;
    var cab = first.querySelector('.ss input[type=hidden]');
    return segRow({ from: to || null, to: from || null, cabin: cab ? cab.value : null });
  }
  function setLk(el, msg, kind) { if (!el) return; el.textContent = msg; el.className = 'seg-lookup-status' + (kind ? ' lk-' + kind : ''); }
  function fillAirport(wrap, iata) {
    if (!wrap) return;
    var A = window.UT_AIRPORTS || [], code = (iata || '').toUpperCase(), inp = wrap.querySelector('.ap-input');
    for (var i = 0; i < A.length; i++) { if (A[i][0] === code) { wrap._selected = { code: A[i][0], city: A[i][1], country: A[i][2], name: A[i][3] }; if (inp) inp.value = A[i][0] + ' — ' + A[i][1]; return; } }
    wrap._selected = { code: code, city: code, country: '', name: '' }; if (inp) inp.value = code;
  }
  async function lookupFlight(card) {
    var fno = ((card.querySelector('.seg-flightno') || {}).value || '').trim();
    var date = (card.querySelector('.seg-date') || {}).value || '';
    var status = card.querySelector('.seg-lookup-status'), btn = card.querySelector('.seg-lookup-btn');
    if (!fno) { setLk(status, 'Enter a flight number first.', 'err'); return; }
    if (!date) { setLk(status, 'Add the depart date, then look up.', 'err'); return; }
    setLk(status, 'Looking up ' + fno.toUpperCase() + '…', '');
    if (btn) btn.disabled = true;
    var res;
    try { res = await sb.functions.invoke('flight-lookup', { body: { flight: fno, date: date } }); }
    catch (e) { res = { error: e }; }
    if (btn) btn.disabled = false;
    var d = res && res.data;
    if ((res && res.error) || !d || d.error) { setLk(status, (d && d.error) || 'Lookup failed. Check the number and date.', 'err'); return; }
    if (d.airline) { var al = card.querySelector('.seg-airline'); if (al) al.value = d.airline; }
    var wraps = card.querySelectorAll('.ap-wrap');
    if (d.from_iata) fillAirport(wraps[0], d.from_iata);
    if (d.to_iata) fillAirport(wraps[1], d.to_iata);
    /* time/date inputs are flatpickr-enhanced (hidden original + visible alt input): set through
       the flatpickr API or the value lands in the hidden input and the field LOOKS empty */
    var setH = function (cls, v) {
      var el = card.querySelector(cls); if (!el) return;
      if (el._flatpickr) { try { el._flatpickr.setDate(v || '', false); } catch (e) { el.value = v || ''; } }
      else el.value = v || '';
    };
    setH('.seg-deptime', toHHMM(d.depart_time)); setH('.seg-arrtime', toHHMM(d.arrive_time)); setH('.seg-aircraft', d.aircraft); setH('.seg-duration', d.duration || '');
    /* rich (itinerary/package) legs also carry terminals — fill only if empty so we never stomp a manual edit */
    var setIfEmpty = function (cls, v) { var el = card.querySelector(cls); if (el && v && !(el.value || '').trim()) el.value = v; };
    setIfEmpty('.seg-depterm', d.dep_terminal); setIfEmpty('.seg-arrterm', d.arr_terminal);
    /* overnight arrivals: the API returns full local datetimes, so fill the arrival DATE when it differs */
    var arrDateM = ('' + (d.arrive_time || '')).match(/^(\d{4}-\d{2}-\d{2})/);
    var segDate = (card.querySelector('.seg-date') || {}).value || '';
    if (arrDateM && segDate && arrDateM[1] !== segDate) {
      var adEl = card.querySelector('.seg-arrdate');
      if (adEl && !(adEl.value || '').trim()) {
        if (adEl._flatpickr) { try { adEl._flatpickr.setDate(arrDateM[1], false); } catch (e2) { adEl.value = arrDateM[1]; } }
        else adEl.value = arrDateM[1];
      }
    }
    if (d.distance_km) { var dk = card.querySelector('.seg-distance'); if (dk) dk.value = d.distance_km; }
    /* fresh times may change the layover on this leg and the one after it */
    var cbThis = card.querySelector('.seg-connect-cb'); if (cbThis && cbThis.checked) autoLayover(card);
    var listEl = card.closest('.inv-segs'); var cards = listEl ? Array.prototype.slice.call(listEl.querySelectorAll('.seg-card')) : []; var ni = cards.indexOf(card) + 1;
    if (ni > 0 && ni < cards.length) { var nc = cards[ni], cbN = nc.querySelector('.seg-connect-cb'); if (cbN && cbN.checked) autoLayover(nc); }
    var route = (d.from_iata || '?') + ' → ' + (d.to_iata || '?');
    var extra = [toHHMM(d.depart_time) && toHHMM(d.arrive_time) ? (toHHMM(d.depart_time) + '–' + toHHMM(d.arrive_time)) : '', d.duration].filter(Boolean).join(' · ');
    setLk(status, 'Filled — ' + [d.airline, route, extra].filter(Boolean).join(' · '), 'ok');
  }
  function readSeg(card, isFirst) {
    var w = card.querySelectorAll('.ap-wrap'), f = w[0] && w[0]._selected, t = w[1] && w[1]._selected;
    if (!f || !t) return null;
    var airline = ((card.querySelector('.seg-airline') || {}).value || '').trim();
    var cabinEl = card.querySelector('.ss input[type=hidden]'), cabin = cabinEl ? cabinEl.value : '';
    var dt = (card.querySelector('.seg-date') || {}).value || '';
    var fn = ((card.querySelector('.seg-flightno') || {}).value || '').trim();
    var dpt = (card.querySelector('.seg-deptime') || {}).value || '', art = (card.querySelector('.seg-arrtime') || {}).value || '', acf = (card.querySelector('.seg-aircraft') || {}).value || '', dur = (card.querySelector('.seg-duration') || {}).value || '';
    var seg = { airline: airline || null, flight_number: fn || null, cabin: cabin || null, from: f, to: t, depart_date: dt || null, depart_time: dpt || null, arrive_time: art || null, aircraft: acf || null, duration: dur || null };
    function pick(cls, key) { var el = card.querySelector(cls); if (el) { var v = (el.value || '').trim(); if (v) seg[key] = v; } }
    var seats = Array.prototype.map.call(card.querySelectorAll('.seg-seats-wrap .seat-chip'), function (el) { return el.getAttribute('data-seat'); });
    var pendSeat = ((card.querySelector('.seg-seats-wrap .seat-input') || {}).value || '').trim(); if (pendSeat) seats.push(pendSeat.toUpperCase());
    if (seats.length) seg.seats = seats;
    pick('.seg-layover-note', 'layover_note'); pick('.seg-conf', 'confirmation'); pick('.seg-opby', 'operated_by'); pick('.seg-depterm', 'dep_terminal'); pick('.seg-arrterm', 'arr_terminal'); pick('.seg-notes', 'notes');
    pick('.seg-arrdate', 'arrive_date'); pick('.seg-etkt', 'eticket');
    var bags = readBaggage(card);
    if (bags.length) seg.baggage = bags;
    else { var lb = ((card.querySelector('.bag-legacy-keep') || {}).value || '').trim(); if (lb) seg.baggage = lb; /* old free-text baggage survives an edit untouched */ }
    var dist = parseInt((card.querySelector('.seg-distance') || {}).value, 10); if (dist > 0) seg.distance_km = dist;
    var cb = card.querySelector('.seg-connect-cb');
    if (cb && cb.checked && !isFirst) {
      seg.connect_from_prev = true;
      var kd = (card.querySelector('.seg-layover-kind') || {}).value || ''; if (kd) seg.layover_kind = kd;
      var ld = ((card.querySelector('.seg-layover-dur') || {}).value || '').trim(); if (ld) seg.layover_duration = ld;
    }
    return seg;
  }
  function readLegsFrom(container, firstCanConnect) {
    var segs = []; if (!container) return segs;
    Array.prototype.forEach.call(container.querySelectorAll('.seg-card'), function (card, i) { var s = readSeg(card, i === 0 && !firstCanConnect); if (s) segs.push(s); });
    return segs;
  }
  function readSegments() { return readLegsFrom(document.getElementById('inv-segs')); }
  function flightDesc(s) {
    var head = [s.airline, s.cabin].filter(Boolean).join(' ');
    var route = s.from.city + ' (' + s.from.code + ') to ' + s.to.city + ' (' + s.to.code + ')';
    return (head ? head + ' — ' : 'Flight — ') + route;
  }
  function flightDetail(s, pax) { var d = []; if (s.depart_date) d.push(fmtDate(s.depart_date)); if (pax) d.push(pax + ' traveler' + (pax > 1 ? 's' : '')); return d.join(' · ') || null; }
  function fillFromFlights() {
    var note = document.getElementById('inv-gen-note'), segs = readSegments(), lines = document.getElementById('inv-lines');
    if (!segs.length) { if (note) { note.textContent = 'Add a flight with a From and To first.'; note.style.display = 'block'; } return; }
    if (note) note.style.display = 'none';
    var pax = (parseInt(val('inv-adults'), 10) || 0) + (parseInt(val('inv-children'), 10) || 0) + (parseInt(val('inv-infants'), 10) || 0);
    Array.prototype.slice.call(lines.querySelectorAll('.inv-line')).forEach(function (r) { if (!r.querySelector('.inv-line-label').value.trim() && !r.querySelector('.inv-line-amt').value) r.remove(); });
    segs.forEach(function (s) { lines.appendChild(lineRow({ label: flightDesc(s), detail: flightDetail(s, pax), amount: null })); });
    lines.appendChild(lineRow()); recalc();
  }
  function customerSearch() {
    var box = h('div', { class: 'cs-wrap' });
    var input = h('input', { id: 'inv-cs', class: 'inv-input', type: 'text', placeholder: 'Search by name, email, account no. or phone…', autocomplete: 'off' });
    var menu = h('div', { class: 'cs-menu', style: 'display:none' });
    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase(); menu.textContent = '';
      if (q.length < 2) { menu.style.display = 'none'; return; }
      var ms = state.customers.filter(function (c) { return (fullName(c) + ' ' + (c.email || '') + ' ' + (c.account_number || '') + ' ' + (c.phone || '')).toLowerCase().indexOf(q) > -1; }).slice(0, 8);
      if (!ms.length) { menu.appendChild(h('div', { class: 'cs-opt cs-none', text: 'No matches' })); menu.style.display = 'block'; return; }
      ms.forEach(function (c) {
        var opt = h('div', { class: 'cs-opt' }, [avatarBox(c, 'cust-av'), h('div', { class: 'cust-row-meta' }, [h('div', { class: 'cust-row-name', text: fullName(c) }), h('div', { class: 'cust-row-sub', text: (c.email || '') + (c.account_number ? '  ·  #' + c.account_number : '') })])]);
        opt.addEventListener('mousedown', function (e) { e.preventDefault(); state.docCustomer = c; state.draftId = null; input.value = ''; menu.style.display = 'none'; renderResolved(c); renderTab(); afterCustomerSelected(c); });
        menu.appendChild(opt);
      });
      menu.style.display = 'block';
    });
    input.addEventListener('blur', function () { setTimeout(function () { menu.style.display = 'none'; }, 160); });
    box.appendChild(input); box.appendChild(menu); return box;
  }
  function renderResolved(p) {
    var box = document.getElementById('inv-cust'); if (!box) return; box.textContent = '';
    box.appendChild(h('div', { class: 'inv-confirm' }, [avatarBox(p, 'cust-av'),
      h('div', { class: 'cust-row-meta' }, [h('div', { class: 'cust-row-name', text: [p.title, fullName(p)].filter(Boolean).join(' ') }), h('div', { class: 'cust-row-sub', text: (p.email || '') + (p.phone ? '  ·  ' + p.phone : '') + (p.account_number ? '  ·  #' + p.account_number : '') })]),
      h('button', { type: 'button', class: 'inv-confirm-clear', title: 'Change', onclick: function () { state.docCustomer = null; box.textContent = ''; }, text: '×' })]));
  }
  var DOC = {
    invoice: { table: 'invoices', numKey: 'invoice_number', head: 'INVOICE', send: 'Send to customer', title: 'New invoice', sub: 'Bill a customer for a trip — it appears in their account.', reviewTitle: 'Review invoice', flashWord: 'Invoice', billLabel: 'Billed to' },
    quote: { table: 'quotes', numKey: 'quote_number', head: 'QUOTE', send: 'Send quote', title: 'New quote', sub: 'Quote a customer for a trip — they can accept it in their account.', reviewTitle: 'Review quote', flashWord: 'Quote', billLabel: 'Prepared for' }
  };
  function dcfg() { return DOC[state.docKind] || DOC.invoice; }
  function enterBuilder(b) { if (state.builderTab === b) return; state.builderTab = b; state.docCustomer = null; state.docDraft = null; state.docView = 'form'; state.docFlash = null; state.itinDraft = null; state.itinView = 'form'; state.draftId = null; }
  function enterDoc(kind) { state.docKind = kind; enterBuilder(kind); }
  /* ---------- per-customer auto-save drafts (Supabase; multiple per customer, cross-device) ---------- */
  function draftKind() { return state.builderTab === 'itinerary' ? 'itinerary' : state.docKind; }
  function draftHasContent(d) {
    if (!d) return false;
    var seg = (d.segments || []).some(function (s) { return s && (s.from || s.to || s.airline || s.flight_number); });
    var li = (d.line_items || []).some(function (i) { return i && (i.label || i.detail || i.amount); });
    return !!(d.title || d.destination || d.notes || d.booking_reference || d.comparable_total || d.total_charged || seg || li || (d.hotels && d.hotels.length) || (d.transport && d.transport.length) || (d.entertainment && d.entertainment.length) || (d.cruises && d.cruises.length) || (d.day_notes && d.day_notes.length) || (d.documents && d.documents.length));
  }
  /* ---- customer-attached drafts (Supabase; multiple per customer, cross-device) ---- */
  function currentDraftData() {
    var isItin = state.builderTab === 'itinerary';
    if (isItin ? state.itinView !== 'form' : state.docView !== 'form') return null;
    if (!document.getElementById(isItin ? 'itin-title' : 'inv-title')) return null;
    var d = isItin ? collectItin() : collectDraft();
    var data = {}; Object.keys(d).forEach(function (k) { if (k !== 'customer') data[k] = d[k]; });
    return data;
  }
  function draftLabel(d) { return (d && (d.title || d.destination)) || 'Untitled trip'; }
  function draftSummary(d) {
    d = d || {};
    var segs = d.segments || [], f = segs[0] && segs[0].from && segs[0].from.city, t = segs[0] && segs[0].to && segs[0].to.city;
    var route = (f && t) ? (f + ' → ' + t) : (d.destination || '');
    var when = (d.start_date ? fmtDate(d.start_date) : '') || (d.valid_until ? ('valid ' + fmtDate(d.valid_until)) : '');
    return [route, when].filter(Boolean).join('  ·  ');
  }
  function setDraftInd(text, on) {
    var ind = document.getElementById('draft-ind'); if (!ind) return;
    ind.textContent = text; ind.classList.toggle('is-on', !!on);
  }
  function draftIdleLabel() { return 'Auto-saving to ' + (state.docCustomer ? (fullName(state.docCustomer) || 'this customer') : 'this customer'); }
  async function persistDraft(data, manual) {
    if (!state.docCustomer || !state.docCustomer.id || !data) return false;
    var kind = draftKind();
    var row = { kind: kind, customer_email: state.docCustomer.email || null, customer_id: state.docCustomer.id || null, title: draftLabel(data), summary: draftSummary(data), payload: data, updated_at: new Date().toISOString() };
    setDraftInd('Saving…', true);
    var r;
    if (state.draftId) r = await sb.from('drafts').update(row).eq('id', state.draftId).select('id').maybeSingle();
    else { r = await sb.from('drafts').insert(row).select('id').maybeSingle(); if (r && r.data) state.draftId = r.data.id; }
    if (!r || r.error) { setDraftInd('Could not save draft', false); return false; }
    setDraftInd(manual ? 'Draft saved ✓' : 'Saved ✓  ·  attached to ' + (fullName(state.docCustomer) || 'customer'), true);
    clearTimeout(setDraftInd._t); setDraftInd._t = setTimeout(function () { setDraftInd(draftIdleLabel(), false); }, 2200);
    return true;
  }
  function autoSaveDraft() {
    try {
      var data = currentDraftData();
      if (!data || data.editing_id || !draftHasContent(data)) return; /* editing a sent doc has its own row */
      persistDraft(data, false);
    } catch (e) { }
  }
  function saveDraftNow(btn) {
    var data = currentDraftData();
    if (!data || !draftHasContent(data)) { setDraftInd('Nothing to save yet', false); return; }
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    persistDraft(data, true).then(function (ok) {
      if (btn) { btn.disabled = false; btn.textContent = ok ? 'Saved ✓' : 'Save draft'; setTimeout(function () { if (btn) btn.textContent = 'Save draft'; }, 1800); }
    });
  }
  function deleteDraftById(id) { if (!id) return Promise.resolve(); return sb.from('drafts').delete().eq('id', id).then(function () { }, function () { }); }
  function clearCurrentDraft() { if (state.draftId) { deleteDraftById(state.draftId); state.draftId = null; } }
  function resumeDraft(d) {
    sb.from('drafts').select('*').eq('id', d.id).maybeSingle().then(function (r) {
      var row = r && r.data; if (!row) return;
      state.docCustomer = findCustomerForDoc({ customer_email: row.customer_email, user_id: row.customer_id });
      state.draftId = row.id;
      if (row.kind === 'itinerary') { state.builderTab = 'itinerary'; state.itinDraft = row.payload; state.itinView = 'form'; state.docKind = null; state.tab = 'itineraries'; }
      else { state.builderTab = row.kind; state.docKind = row.kind; state.docDraft = row.payload; state.docView = 'form'; state.tab = (row.kind === 'invoice') ? 'invoices' : 'quotes'; }
      refreshNav(); renderTab();
    });
  }
  /* the "resume a saved draft" bar shown at the top of a builder for the current customer */
  function draftsBar(kind) {
    var host = h('div', { id: 'drafts-bar' });
    if (state.docCustomer && state.docCustomer.id) setTimeout(function () { loadDraftsBar(kind); }, 0);
    return host;
  }
  async function loadDraftsBar(kind) {
    var host = document.getElementById('drafts-bar'); if (!host) return;
    if (!state.docCustomer || !state.docCustomer.id) return;
    var r = await sb.from('drafts').select('id, title, summary, kind, updated_at, customer_email, customer_id').eq('customer_id', state.docCustomer.id).eq('kind', kind).order('updated_at', { ascending: false });
    host = document.getElementById('drafts-bar'); if (!host) return;
    var rows = (r.data || []).filter(function (d) { return d.id !== state.draftId; });
    host.textContent = '';
    if (!rows.length) return;
    var box = h('div', { class: 'drafts-bar' }, [h('div', { class: 'drafts-bar-h', text: rows.length + ' other saved draft' + (rows.length > 1 ? 's' : '') + ' for ' + (fullName(state.docCustomer) || 'this customer') })]);
    rows.forEach(function (d) {
      box.appendChild(h('div', { class: 'drafts-row' }, [
        h('div', { class: 'drafts-row-main' }, [h('b', { text: d.title || 'Untitled trip' }), h('span', { class: 'drafts-row-sub', text: [d.summary, 'saved ' + fmtDate(d.updated_at)].filter(Boolean).join('  ·  ') })]),
        h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto; padding:6px 12px', onclick: function () { resumeDraft(d); }, text: 'Resume' }),
        h('button', { type: 'button', class: 'drafts-del', title: 'Delete draft', onclick: function () { confirmDialog({ title: 'Delete draft', message: 'Delete the saved draft “' + (d.title || 'Untitled trip') + '”?', detail: 'It is removed for good.', danger: true, confirmText: 'Delete', onConfirm: function () { deleteDraftById(d.id).then(function () { loadDraftsBar(kind); }); } }); }, text: '×' })
      ]));
    });
    host.appendChild(box);
  }
  async function loadCustDrafts(p) {
    var box = document.getElementById('cd-drafts'); if (!box) return;
    var r = await sb.from('drafts').select('id, kind, title, summary, updated_at, customer_email, customer_id').eq('customer_id', p.id).order('updated_at', { ascending: false });
    box = document.getElementById('cd-drafts'); if (!box) return;
    var rows = r.data || []; box.textContent = ''; box.appendChild(h('h4', { text: 'Saved drafts' }));
    if (!rows.length) { box.appendChild(h('p', { class: 'cd-book-none', text: 'No drafts in progress.' })); return; }
    rows.forEach(function (d) {
      box.appendChild(h('div', { class: 'cd-draft-row' }, [
        h('span', { class: 'cd-draft-kind', text: cap(d.kind) }),
        h('div', { class: 'cd-draft-main' }, [h('b', { text: d.title || 'Untitled trip' }), h('span', { class: 'cd-book-sub', text: [d.summary, 'saved ' + fmtDate(d.updated_at)].filter(Boolean).join('  ·  ') })]),
        h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto; padding:6px 12px', onclick: function () { resumeDraft(d); }, text: 'Resume' }),
        h('button', { type: 'button', class: 'cd-book-del', title: 'Delete draft', onclick: function () { confirmDialog({ title: 'Delete draft', message: 'Delete the saved draft “' + (d.title || 'Untitled trip') + '”?', detail: 'It is removed for good.', danger: true, confirmText: 'Delete', onConfirm: function () { deleteDraftById(d.id).then(function () { loadCustDrafts(p); }); } }); }, text: '×' })
      ]));
    });
  }
  function flashEl(flash) { return h('div', { class: 'msg ' + flash.kind }, [h('span', { text: flash.text })]); }
  var _saveT = null;
  function scheduleSave() { if (!state.docCustomer || !state.docCustomer.id) return; if (['invoices', 'quotes', 'itineraries'].indexOf(state.tab) < 0) return; clearTimeout(_saveT); _saveT = setTimeout(autoSaveDraft, 1200); }
  document.addEventListener('input', scheduleSave);
  /* auto-capitalize typed text fields on blur; skips emails, URLs, flight numbers and codes */
  document.addEventListener('blur', function (e) {
    var el = e.target;
    if (!el || el.tagName !== 'INPUT' || (el.type !== 'text' && el.type !== 'search')) return;
    if (!el.classList || !el.classList.contains('inv-input')) return;
    if (/seg-flightno|seg-conf|seg-etkt|seg-opby|doc-url|list-search|gs-input|seat-input|itin-pull-inv|inv-line-amt/.test(el.className)) return;
    var v = el.value; if (!v || /@/.test(v) || /^https?:/i.test(v)) return;
    var cap = v.replace(/(^|[\s\-\/(])([a-z])/g, function (m, p, c) { return p + c.toUpperCase(); });
    if (cap !== v) el.value = cap;
  }, true);
  document.addEventListener('change', scheduleSave);
  function tabInvoices() {
    enterDoc('invoice');
    var wrap = tabDoc();
    if (state.docView === 'form') {
      var body = wrap.querySelector('.main-body');
      if (body) body.insertBefore(docListBar('invoice'), body.firstChild);
    }
    return wrap;
  }
  function docListBar(kind) {
    var main = [h('span', { class: 'sent-bar-label', text: kind === 'invoice' ? 'Invoices' : 'Your quotes' }), h('span', { class: 'sent-bar-count', id: 'doc-bar-count', text: '' })];
    if (kind === 'invoice') main.push(h('span', { class: 'sent-bar-note', id: 'doc-bar-note', text: '' }));
    var bar = h('div', { class: 'sent-bar' }, [
      h('div', { class: 'sent-bar-main' }, main),
      h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto', onclick: function () { state.docView = 'list'; renderTab(); }, text: 'View all' })
    ]);
    setTimeout(function () { loadDocBarCounts(kind); }, 0);
    return bar;
  }
  async function loadDocBarCounts(kind) {
    var cEl = document.getElementById('doc-bar-count'); if (!cEl) return;
    if (kind === 'invoice') {
      var res = await Promise.all([sb.from('invoices').select('id', { count: 'exact', head: true }), sb.from('invoices').select('total_charged, amount_paid, currency')]);
      cEl = document.getElementById('doc-bar-count'); if (!cEl) return;
      cEl.textContent = (res[0].count != null ? res[0].count : 0);
      var rows = res[1].data || [], out = 0, cur = 'USD'; rows.forEach(function (i) { out += Math.max(dnum(i.total_charged) - dnum(i.amount_paid), 0); if (i.currency) cur = i.currency; });
      var nEl = document.getElementById('doc-bar-note'); if (nEl) nEl.textContent = out > 0 ? money(out, cur) + ' outstanding' : 'All settled';
    } else {
      var r = await sb.from('quotes').select('id', { count: 'exact', head: true });
      cEl = document.getElementById('doc-bar-count'); if (!cEl) return;
      cEl.textContent = (r.count != null ? r.count : 0);
    }
  }
  function findCustomerNameByEmail(email) {
    if (!email) return ''; var e = email.toLowerCase();
    for (var i = 0; i < state.customers.length; i++) { if ((state.customers[i].email || '').toLowerCase() === e) return fullName(state.customers[i]); }
    return '';
  }
  async function loadInvoiceList() {
    var box = document.getElementById('invlist-box'); if (!box) return;
    var res = await Promise.all([
      sb.from('invoices').select('*').order('created_at', { ascending: false }).limit(200),
      sb.from('invoice_finance').select('invoice_id, net_cost')
    ]);
    if (!document.getElementById('invlist-box')) return;
    state.allInvoices = res[0].data || [];
    state.invCostMap = {};
    (res[1].data || []).forEach(function (f) { state.invCostMap[f.invoice_id] = f.net_cost; });
    renderInvoiceList();
  }
  function renderInvoiceList() {
    var box = document.getElementById('invlist-box'); if (!box) return;
    var invs = state.allInvoices || []; box.textContent = '';
    if (!invs.length) { box.appendChild(emptyBox('invoice', 'No invoices yet', 'Send your first invoice and it appears here with payments and profit.')); return; }
    var needle = (state.invSearch || '').trim().toLowerCase();
    var shown = !needle ? invs : invs.filter(function (i) { return ((i.invoice_number || '') + ' ' + (i.title || '') + ' ' + (i.customer_email || '') + ' ' + findCustomerNameByEmail(i.customer_email) + ' ' + quoteRouteLabel(i)).toLowerCase().indexOf(needle) > -1; });
    var outstanding = 0; invs.forEach(function (i) { outstanding += Math.max(dnum(i.total_charged) - dnum(i.amount_paid), 0); });
    box.appendChild(h('div', { class: 'sq-wrap' }, [
      h('div', { class: 'invlist-head' }, [h('h3', { class: 'sq-h', text: 'Invoices · ' + (needle ? shown.length + ' of ' + invs.length : invs.length) }), h('span', { class: 'invlist-out' + (outstanding > 0 ? ' is-due' : ''), text: outstanding > 0 ? money(outstanding, invs[0].currency || 'USD') + ' outstanding' : 'All settled ✓' })])
    ].concat(shown.length ? shown.map(function (inv) { return invoiceRow(inv, state.invCostMap[inv.id]); }) : [h('p', { class: 'qf-empty', text: 'Nothing matches that search.' })])));
  }
  async function deleteInvoiceRow(inv) {
    try { await sb.from('invoice_finance').delete().eq('invoice_id', inv.id); } catch (e) { /* may not exist */ }
    try { await sb.from('invoices').delete().eq('id', inv.id); } catch (e) { console.warn('delete invoice failed', e); }
    loadInvoiceList();
  }
  function invoiceRow(inv, netCost) {
    var total = dnum(inv.total_charged), paid = dnum(inv.amount_paid), bal = Math.max(total - paid, 0);
    var status = bal <= 0.001 ? 'paid' : (paid > 0 ? 'partial' : 'unpaid');
    var label = status === 'paid' ? 'Paid' : status === 'partial' ? 'Partial' : 'Unpaid';
    var cur = inv.currency || 'USD';
    var bits = [inv.invoice_number, quoteRouteLabel(inv), money(total, cur)];
    if (status !== 'paid') bits.push(money(bal, cur) + ' due');
    if (netCost != null) bits.push('profit ' + money(total - dnum(netCost), cur));
    return h('div', { class: 'sq-card invrow' }, [
      h('div', { class: 'sq-main' }, [
        h('div', { class: 'sq-top' }, [h('div', { class: 'sq-name', text: findCustomerNameByEmail(inv.customer_email) || inv.customer_email }), h('span', { class: 'sq-badge inv-st-' + status, text: label })]),
        h('div', { class: 'sq-sub', text: bits.filter(Boolean).join('  ·  ') })
      ]),
      h('div', { class: 'sq-actions invrow-act' }, (status === 'paid'
        ? [h('span', { class: 'invrow-paid', text: '✓ Settled' })]
        : [h('button', { type: 'button', class: 'btn btn-primary', style: 'width:auto; padding:8px 14px', onclick: function (e) { startRecordPayment(e.target.closest('.invrow'), inv, bal); }, text: 'Record payment' })]
      ).concat([
        h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto; padding:8px 14px', onclick: function () { adminOverlay(invoiceDetail(inv, netCost), 'Invoice ' + (inv.invoice_number || '')); }, text: 'View' }),
        h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto; padding:8px 14px', onclick: function () { editInvoice(inv, netCost); }, text: 'Edit & resend' }),
        h('button', { type: 'button', class: 'btn btn-ghost pkg-del-btn', style: 'width:auto; padding:8px 14px', onclick: function () { confirmDialog({ title: 'Delete invoice', message: 'Delete ' + (inv.invoice_number || 'this invoice') + '?', detail: 'It disappears from the customer\u2019s account, along with its recorded payments and profit. This cannot be undone.', danger: true, confirmText: 'Delete invoice', onConfirm: function () { deleteInvoiceRow(inv); } }); }, text: 'Delete' })
      ]))
    ]);
  }
  function invoiceDetail(inv, netCost) {
    var cust = findCustomerForDoc(inv), node = h('div', { class: 'qd' });
    var total = dnum(inv.total_charged), paid = dnum(inv.amount_paid), bal = Math.max(total - paid, 0);
    node.appendChild(h('div', { class: 'qd-head' }, [
      h('div', null, [h('h3', { class: 'qd-title', text: inv.title || ('Invoice ' + (inv.invoice_number || '')) }), h('div', { class: 'qd-sub', text: [fullName(cust), inv.customer_email].filter(Boolean).join('  ·  ') })]),
      h('span', { class: 'sq-badge inv-st-' + (bal <= 0.001 ? 'paid' : paid > 0 ? 'partial' : 'unpaid'), text: bal <= 0.001 ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid' })
    ]));
    var chips = [inv.invoice_number, ttLabel(inv.trip_type), inv.destination, paxLabel(inv), inv.created_at ? 'Sent ' + fmtDate(inv.created_at) : '', inv.due_date ? 'Due ' + fmtDate(inv.due_date) : ''].filter(Boolean);
    node.appendChild(h('div', { class: 'qd-chips' }, chips.map(function (c) { return h('span', { class: 'qd-chip', text: c }); })));
    if ((inv.segments || []).length) {
      node.appendChild(h('h4', { class: 'qd-h', text: 'Routing' }));
      node.appendChild(h('div', { class: 'qd-flights' }, inv.segments.map(function (s) {
        return h('div', { class: 'qd-seg' }, [h('div', { class: 'rev-strong', text: (s.from && s.from.code) + ' → ' + (s.to && s.to.code) + ((s.airline || s.cabin) ? '  ·  ' + [s.airline, s.cabin].filter(Boolean).join(' ') : '') }), s.depart_date ? h('div', { class: 'rev-line', text: fmtDate(s.depart_date) }) : null]);
      })));
    }
    if ((inv.line_items || []).length) {
      node.appendChild(h('h4', { class: 'qd-h', text: 'Charges' }));
      node.appendChild(h('div', { class: 'qd-flights' }, inv.line_items.map(function (li) {
        return h('div', { class: 'qd-seg qd-li' }, [h('span', { text: li.label }), h('b', { text: money(dnum(li.amount), inv.currency || 'USD') })]);
      })));
    }
    node.appendChild(h('div', { class: 'qd-totals' }, [
      h('div', { class: 'rev-line', text: 'Total ' + money(total, inv.currency || 'USD') + '   ·   Paid ' + money(paid, inv.currency || 'USD') + (bal > 0.001 ? '   ·   Balance ' + money(bal, inv.currency || 'USD') : '') + (netCost != null ? '   ·   Profit ' + money(total - dnum(netCost), inv.currency || 'USD') : '') })
    ]));
    return node;
  }
  function editInvoice(inv, netCost) {
    state.docCustomer = findCustomerForDoc(inv);
    state.builderTab = 'invoice'; state.docKind = 'invoice';
    state.draftId = null; state.docDraft = { editing_id: inv.id, editing_number: inv.invoice_number, title: inv.title || '', destination: inv.destination || '', trip_type: inv.trip_type || null, segments: inv.segments || [], pax_adults: inv.pax_adults != null ? inv.pax_adults : 1, pax_children: inv.pax_children || 0, pax_infants: inv.pax_infants || 0, booking_reference: inv.booking_reference || '', line_items: inv.line_items || [], currency: inv.currency || 'USD', comparable_total: inv.comparable_total || null, deposit_paid: inv.deposit_paid || null, due_date: inv.due_date || null, net_cost: netCost != null ? netCost : null, payment_methods: inv.payment_methods || null, notes: inv.notes || '' };
    state.docFlash = { kind: 'note', text: 'Editing ' + (inv.invoice_number || 'this invoice') + '. Make your changes, then review & resend — it updates the same invoice. Recorded payments are kept.' };
    state.docView = 'form'; state.tab = 'invoices'; refreshNav(); renderTab();
  }
  function startRecordPayment(rowEl, inv, balance) {
    var act = rowEl.querySelector('.invrow-act'); if (!act) return;
    act.textContent = '';
    var amt = h('input', { class: 'inv-input invrow-amt', type: 'number', step: '0.01', min: '0', value: balance });
    var save = h('button', { type: 'button', class: 'btn btn-primary', style: 'width:auto; padding:8px 12px', onclick: function () { recordPayment(inv, parseFloat(amt.value) || 0); }, text: 'Save' });
    var cancel = h('button', { type: 'button', class: 'tpl-cancel', onclick: function () { loadInvoiceList(); }, text: 'Cancel' });
    act.appendChild(amt); act.appendChild(save); act.appendChild(cancel);
    setTimeout(function () { amt.focus(); if (amt.select) amt.select(); }, 0);
  }
  async function recordPayment(inv, amount) {
    if (!(amount > 0)) { loadInvoiceList(); return; }
    var newPaid = dnum(inv.amount_paid) + amount, total = dnum(inv.total_charged), patch = { amount_paid: newPaid };
    if (newPaid >= total - 0.001) patch.paid_at = new Date().toISOString();
    await sb.from('invoices').update(patch).eq('id', inv.id);
    loadInvoiceList();
  }
  function tabQuotes() {
    enterDoc('quote');
    var wrap = tabDoc();
    if (state.docView === 'form') {
      var body = wrap.querySelector('.main-body');
      if (body) {
        body.insertBefore(docListBar('quote'), body.firstChild);
        body.insertBefore(reqListBar(), body.firstChild);
      }
    }
    return wrap;
  }
  function reqListBar() {
    var bar = h('div', { class: 'sent-bar' }, [
      h('div', { class: 'sent-bar-main' }, [h('span', { class: 'sent-bar-label', text: 'Incoming requests' }), h('span', { class: 'sent-bar-count', id: 'req-bar-count', text: '' })]),
      h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto', onclick: function () { state.docView = 'requests'; renderTab(); }, text: 'View all' })
    ]);
    setTimeout(loadReqBarCount, 0);
    return bar;
  }
  async function loadReqBarCount() {
    var r = await sb.from('quote_requests').select('id', { count: 'exact', head: true }).eq('status', 'new');
    var nCount = r.count != null ? r.count : 0;
    var el = document.getElementById('req-bar-count'); if (el) el.textContent = String(nCount);
    var badge = document.getElementById('nav-badge-quotes');
    if (badge) { badge.textContent = String(nCount); badge.style.display = nCount > 0 ? '' : 'none'; }
  }
  function findCustomerForDoc(q) {
    var c = null, em = (q.customer_email || '').toLowerCase();
    if (em) { for (var i = 0; i < state.customers.length; i++) { if ((state.customers[i].email || '').toLowerCase() === em) { c = state.customers[i]; break; } } }
    if (!c) c = { id: q.user_id || null, email: q.customer_email || '', first_name: q.customer_email || 'Customer', last_name: '', account_number: q.account_number || null };
    return c;
  }
  function quoteRouteLabel(q) { var s = (q.segments || [])[0]; return (s && s.from && s.to) ? (s.from.code + ' → ' + s.to.code) : ''; }
  function sqStatusLabel(s) { return s === 'accepted' ? 'Accepted' : s === 'declined' ? 'Declined' : s === 'converted' ? 'Converted' : 'Sent'; }
  function ttLabel(t) { return { round: 'Round trip', one_way: 'One way', multi: 'Multi-city' }[t] || ''; }
  function legRole(tt, i, n) { if (tt === 'round') return i === 0 ? 'Outbound' : (i === 1 ? 'Return' : 'Flight ' + (i + 1)); if (tt === 'multi' || n > 1) return 'Flight ' + (i + 1); return ''; }
  function adminOverlay(node, title) {
    closeAdminOverlay();
    var ov = h('div', { class: 'adm-overlay', id: 'adm-overlay' });
    ov.addEventListener('click', function (e) { if (e.target === ov) closeAdminOverlay(); });
    ov.appendChild(h('div', { class: 'adm-modal' }, [
      h('div', { class: 'adm-modal-bar' }, [h('span', { class: 'adm-modal-title', text: title || '' }), h('button', { type: 'button', class: 'adm-modal-close', onclick: closeAdminOverlay, text: '×' })]),
      h('div', { class: 'adm-modal-body' }, [node])
    ]));
    document.body.appendChild(ov);
  }
  function closeAdminOverlay() { var o = document.getElementById('adm-overlay'); if (o) o.remove(); }
  function quoteDetail(q) {
    var cust = findCustomerForDoc(q), segs = q.segments || [], node = h('div', { class: 'qd' });
    node.appendChild(h('div', { class: 'qd-head' }, [
      h('div', null, [h('h3', { class: 'qd-title', text: q.title || ('Quote ' + (q.quote_number || '')) }), h('div', { class: 'qd-sub', text: [fullName(cust), cust.email].filter(Boolean).join('  ·  ') })]),
      h('span', { class: 'sq-badge sq-' + (q.status || 'sent'), text: sqStatusLabel(q.status) })
    ]));
    var chips = [q.quote_number, ttLabel(q.trip_type), q.destination, paxLabel(q), q.created_at ? 'Sent ' + fmtDate(q.created_at) : '', q.valid_until ? 'Valid until ' + fmtDate(q.valid_until) : '', q.chosen_option ? 'Chose ' + q.chosen_option : ''].filter(Boolean);
    node.appendChild(h('div', { class: 'qd-chips' }, chips.map(function (c) { return h('span', { class: 'qd-chip', text: c }); })));
    if (segs.length) {
      node.appendChild(h('h4', { class: 'qd-h', text: 'Flights' }));
      node.appendChild(h('div', { class: 'qd-flights' }, segs.map(function (s, i) {
        var role = legRole(q.trip_type, i, segs.length), when = [];
        var dep = [s.depart_date ? fmtDate(s.depart_date) : '', fmtTime(s.depart_time)].filter(Boolean).join(' · ');
        if (dep) when.push('Departs ' + dep);
        if (s.arrive_time) when.push('Arrives ' + fmtTime(s.arrive_time));
        return h('div', { class: 'qd-seg' }, [
          role ? h('div', { class: 'qd-seg-role', text: role }) : null,
          h('div', { class: 'qd-seg-head' }, [h('b', { text: [s.airline, s.cabin].filter(Boolean).join(' · ') || 'Flight' }), h('span', { class: 'qd-seg-route', text: (s.from ? s.from.code : '?') + ' → ' + (s.to ? s.to.code : '?') })]),
          h('div', { class: 'qd-seg-sub', text: [(s.from ? s.from.city : '') + ' to ' + (s.to ? s.to.city : ''), s.flight_number, s.aircraft].filter(Boolean).join('  ·  ') }),
          when.length ? h('div', { class: 'qd-seg-when', text: when.join('     ') }) : null
        ]);
      })));
    }
    function qdSec(title, arr, lineFn) { if (!arr || !arr.length) return; node.appendChild(h('h4', { class: 'qd-h', text: title })); arr.forEach(function (x) { node.appendChild(h('div', { class: 'qd-seg' }, lineFn(x))); }); }
    qdSec('Hotels', q.hotels, function (x) { return [h('div', { class: 'rev-strong', text: x.name || 'Hotel' }), h('div', { class: 'rev-line', text: [x.location, x.room, x.board, (x.checkin_date ? fmtDate(x.checkin_date) : '')].filter(Boolean).join('  ·  ') })]; });
    qdSec('Transfers', q.transport, function (x) { return [h('div', { class: 'rev-strong', text: x.type || 'Transfer' }), h('div', { class: 'rev-line', text: [[x.from, x.to].filter(Boolean).join(' → '), (x.date ? fmtDate(x.date) : '')].filter(Boolean).join('  ·  ') })]; });
    qdSec('Dining & experiences', q.entertainment, function (x) { return [h('div', { class: 'rev-strong', text: x.name || 'Experience' }), h('div', { class: 'rev-line', text: [x.category, x.location, (x.date ? fmtDate(x.date) : '')].filter(Boolean).join('  ·  ') })]; });
    qdSec('Cruises', q.cruises, function (x) { return [h('div', { class: 'rev-strong', text: [x.line, x.ship].filter(Boolean).join('  ·  ') || 'Cruise' }), h('div', { class: 'rev-line', text: [[x.embark_port, x.disembark_port].filter(Boolean).join(' → '), (x.embark_date ? fmtDate(x.embark_date) : '')].filter(Boolean).join('  ·  ') })]; });
    if (q.line_items && q.line_items.length) {
      node.appendChild(h('h4', { class: 'qd-h', text: 'Quote' }));
      node.appendChild(h('table', { class: 'qd-table' }, q.line_items.map(function (it) { return h('tr', null, [h('td', { text: it.label + (it.detail ? ' — ' + it.detail : '') }), h('td', { class: 'qd-amt', text: money(it.amount, q.currency) })]); })));
    }
    var total = Number(q.total_charged) || 0, comp = Number(q.comparable_total) || 0;
    node.appendChild(h('div', { class: 'qd-totals' }, [
      h('div', { class: 'qd-trow qd-trow-big' }, [h('span', { text: 'Your price' }), h('b', { text: money(total, q.currency) })]),
      comp > total ? h('div', { class: 'qd-trow' }, [h('span', { text: 'Comparable price' }), h('span', { text: money(comp, q.currency) })]) : null,
      comp > total ? h('div', { class: 'qd-trow qd-saved' }, [h('span', { text: 'They save' }), h('b', { text: money(comp - total, q.currency) })]) : null
    ]));
    if (q.options && q.options.length) {
      node.appendChild(h('h4', { class: 'qd-h', text: 'Alternative options' }));
      q.options.forEach(function (o) {
        node.appendChild(h('div', { class: 'qd-seg' }, [
          h('div', { class: 'rev-strong', text: (o.label || 'Option') + (q.chosen_option === o.label ? '  · CHOSEN' : '') }),
          h('div', { class: 'rev-line', text: [o.desc, money(Number(o.total) || 0, q.currency), (Number(o.comparable) > Number(o.total)) ? 'comparable ' + money(Number(o.comparable), q.currency) : ''].filter(Boolean).join('  ·  ') })
        ]));
      });
    }
    if (q.notes) { node.appendChild(h('h4', { class: 'qd-h', text: 'Notes' })); node.appendChild(h('p', { class: 'qd-notes', text: q.notes })); }
    node.appendChild(h('div', { class: 'qd-foot' }, [
      h('button', { type: 'button', class: 'btn btn-primary', style: 'width:auto', onclick: function () { closeAdminOverlay(); editQuote(q); }, text: 'Edit & resend' }),
      h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto', onclick: function () { closeAdminOverlay(); convertQuoteToInvoice(q); }, text: '→ Invoice' }),
      h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto', onclick: function () { closeAdminOverlay(); convertQuoteToItinerary(q); }, text: '→ Itinerary' })
    ]));
    return node;
  }
  function editQuote(q) {
    state.docCustomer = findCustomerForDoc(q);
    state.builderTab = 'quote'; state.docKind = 'quote';
    state.draftId = null; state.docDraft = { editing_id: q.id, editing_number: q.quote_number, title: q.title || '', destination: q.destination || '', trip_type: q.trip_type || null, segments: q.segments || [], pax_adults: q.pax_adults != null ? q.pax_adults : 1, pax_children: q.pax_children || 0, pax_infants: q.pax_infants || 0, booking_reference: q.booking_reference || '', line_items: q.line_items || [], currency: q.currency || 'USD', comparable_total: q.comparable_total || null, valid_until: q.valid_until || null, options: q.options || [], hotels: q.hotels || [], transport: q.transport || [], entertainment: q.entertainment || [], cruises: q.cruises || [], notes: q.notes || '' };
    state.docFlash = { kind: 'note', text: 'Editing ' + (q.quote_number || 'this quote') + '. Make your changes, then review & resend — it updates the same quote.' };
    state.docView = 'form'; state.tab = 'quotes'; refreshNav(); renderTab();
  }
  async function loadSentQuotes() {
    var box = document.getElementById('sentq-box'); if (!box) return;
    var r = await sb.from('quotes').select('*').order('created_at', { ascending: false }).limit(200);
    box = document.getElementById('sentq-box'); if (!box) return;
    state.allQuotes = r.data || [];
    renderSentQuotes();
  }
  function renderSentQuotes() {
    var box = document.getElementById('sentq-box'); if (!box) return;
    var qs = state.allQuotes || []; box.textContent = '';
    if (!qs.length) { box.appendChild(emptyBox('quote', 'No quotes yet', 'Quotes you send appear here with their status and follow-ups.')); return; }
    var filt = state.quoteFilter || 'all';
    var counts = { all: qs.length, sent: 0, accepted: 0, declined: 0 };
    qs.forEach(function (q) { var s = q.status || 'sent'; if (counts[s] != null) counts[s]++; });
    var chips = [['all', 'All'], ['sent', 'Sent'], ['accepted', 'Accepted'], ['declined', 'Declined']].map(function (f) {
      return h('button', { type: 'button', class: 'qf-chip' + (filt === f[0] ? ' is-active' : ''), onclick: function () { state.quoteFilter = f[0]; renderSentQuotes(); }, text: f[1] + ' (' + (counts[f[0]] || 0) + ')' });
    });
    var shown = filt === 'all' ? qs : qs.filter(function (q) { return (q.status || 'sent') === filt; });
    var qNeedle = (state.qSearch || '').trim().toLowerCase();
    if (qNeedle) shown = shown.filter(function (q) { return ((q.quote_number || '') + ' ' + (q.title || '') + ' ' + (q.customer_email || '') + ' ' + findCustomerNameByEmail(q.customer_email) + ' ' + quoteRouteLabel(q)).toLowerCase().indexOf(qNeedle) > -1; });
    box.appendChild(h('div', { class: 'sq-wrap' }, [
      h('div', { class: 'sq-head-row' }, [h('h3', { class: 'sq-h', text: 'Your quotes' }), h('div', { class: 'qf-chips' }, chips)])
    ].concat(shown.length ? shown.map(sentQuoteCard) : [h('p', { class: 'qf-empty', text: 'No ' + (filt === 'all' ? '' : filt + ' ') + 'quotes yet.' })])));
  }
  function sentQuoteCard(q) {
    var cust = findCustomerForDoc(q), nm = fullName(cust) || q.customer_email || 'Customer';
    var sub = [q.quote_number, ttLabel(q.trip_type), quoteRouteLabel(q), q.total_charged != null ? money(q.total_charged, q.currency || 'USD') : ''].filter(Boolean).join('  ·  ');
    return h('div', { class: 'sq-card' }, [
      h('div', { class: 'sq-main' }, [
        h('div', { class: 'sq-top' }, [h('div', { class: 'sq-name', text: nm }), h('span', { class: 'sq-badge sq-' + (q.status || 'sent'), text: sqStatusLabel(q.status) })]),
        sub ? h('div', { class: 'sq-sub', text: sub }) : null
      ]),
      h('div', { class: 'sq-actions' }, [
        h('button', { type: 'button', class: 'btn btn-primary', style: 'width:auto; padding:8px 14px', onclick: function () { adminOverlay(quoteDetail(q), 'Quote ' + (q.quote_number || '')); }, text: 'View' }),
        h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto; padding:8px 14px', onclick: function () { editQuote(q); }, text: 'Edit & resend' }),
        h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto; padding:8px 14px', onclick: function () { convertQuoteToInvoice(q); }, text: '→ Invoice' }),
        h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto; padding:8px 14px', onclick: function () { convertQuoteToItinerary(q); }, text: '→ Itinerary' }),
        ((q.status || 'sent') === 'sent') ? h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto; padding:8px 14px', onclick: function (e) { sendQuoteNudge(q, e.target); }, text: q.nudged_at ? 'Follow up again' : 'Send follow-up' }) : null,
        h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto; padding:8px 14px', onclick: function () { duplicateQuote(q); }, text: 'Duplicate' }),
        h('button', { type: 'button', class: 'btn btn-ghost pkg-del-btn', style: 'width:auto; padding:8px 14px', onclick: function () { confirmDialog({ title: 'Delete quote', message: 'Delete ' + (q.quote_number || 'this quote') + '?', detail: 'It disappears from the customer\u2019s account too. This cannot be undone.', danger: true, confirmText: 'Delete quote', onConfirm: function () { deleteQuoteRow(q); } }); }, text: 'Delete' })
      ])
    ]);
  }
  function duplicateQuote(q) {
    state.docCustomer = findCustomerForDoc(q);
    state.builderTab = 'quote'; state.docKind = 'quote';
    state.docDraft = { title: q.title || '', destination: q.destination || '', trip_type: q.trip_type || null, segments: q.segments || [], pax_adults: q.pax_adults != null ? q.pax_adults : 1, pax_children: q.pax_children || 0, pax_infants: q.pax_infants || 0, booking_reference: q.booking_reference || '', line_items: q.line_items || [], currency: q.currency || 'USD', comparable_total: q.comparable_total || null, valid_until: null, options: q.options || [], hotels: q.hotels || [], transport: q.transport || [], entertainment: q.entertainment || [], cruises: q.cruises || [], notes: q.notes || '' };
    state.draftId = null;
    state.docFlash = { kind: 'note', text: 'Duplicated from ' + (q.quote_number || 'the quote') + '. Adjust anything, then send as a new quote.' };
    state.docView = 'form'; state.tab = 'quotes'; refreshNav(); renderTab();
  }
  function sendQuoteNudge(q, btn) {
    confirmDialog({
      title: 'Send follow-up', message: 'Email ' + (q.customer_email || 'the customer') + ' a reminder about ' + (q.quote_number || 'this quote') + '?',
      detail: 'A branded note that their private fare is ready' + (q.valid_until ? ' and expires ' + fmtDate(q.valid_until) : '') + (q.nudged_at ? '. Last follow-up: ' + fmtDate(q.nudged_at) + '.' : '.'),
      confirmText: 'Send follow-up',
      onConfirm: function () {
        if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
        sb.functions.invoke('quote-nudge', { body: { quote_id: q.id } }).then(function (r) {
          var err = (r.error && r.error.message) || (r.data && r.data.error);
          if (btn) { btn.disabled = false; btn.textContent = err ? 'Failed, try again' : 'Follow-up sent ✓'; }
          if (!err) q.nudged_at = new Date().toISOString();
        }).catch(function () { if (btn) { btn.disabled = false; btn.textContent = 'Failed, try again'; } });
      }
    });
  }
  async function deleteQuoteRow(q) {
    try { await sb.from('quotes').delete().eq('id', q.id); } catch (e) { console.warn('delete quote failed', e); }
    loadSentQuotes();
  }
  function convertQuoteToInvoice(q) {
    state.docCustomer = findCustomerForDoc(q);
    state.builderTab = 'invoice'; state.docKind = 'invoice';
    state.docDraft = { title: q.title || '', destination: q.destination || '', segments: q.segments || [], pax_adults: q.pax_adults != null ? q.pax_adults : 1, pax_children: q.pax_children || 0, pax_infants: q.pax_infants || 0, booking_reference: q.booking_reference || '', line_items: q.line_items || [], currency: q.currency || 'USD', comparable_total: q.comparable_total || null, notes: q.notes || '', source_quote_id: q.id };
    state.docFlash = { kind: 'note', text: 'Started from quote ' + (q.quote_number || '') + '. Add any invoice details, then review & send.' };
    state.docView = 'form'; state.tab = 'invoices'; refreshNav(); renderTab();
  }
  function convertQuoteToItinerary(q) {
    state.docCustomer = findCustomerForDoc(q);
    var segs = q.segments || [], s0 = segs[0], sN = segs[segs.length - 1];
    /* the quote already knows the pricing — carry it so the savings hero renders without re-entry */
    var total = q.total_charged != null ? q.total_charged : (q.line_items || []).reduce(function (s, i) { return s + (parseFloat(i.amount) || 0); }, 0) || null;
    state.builderTab = 'itinerary';
    state.itinDraft = { title: q.title || '', destination: q.destination || '', trip_type: q.trip_type || null, start_date: s0 ? s0.depart_date : null, end_date: sN ? (sN.return_date || sN.depart_date) : null, pax_adults: q.pax_adults != null ? q.pax_adults : 1, pax_children: q.pax_children || 0, pax_infants: q.pax_infants || 0, segments: segs, hotels: q.hotels || [], transport: q.transport || [], entertainment: q.entertainment || [], cruises: q.cruises || [], notes: q.notes || '', total_charged: total, comparable_total: q.comparable_total || null, currency: q.currency || 'USD' };
    state.itinFlash = { kind: 'note', text: 'Started from quote ' + (q.quote_number || '') + ' — pricing carried over. Add hotels, transfers & experiences.' };
    state.itinView = 'form'; state.tab = 'itineraries'; refreshNav(); renderTab();
  }
  function quoteStartBar(target) {
    var section = h('div', { class: 'inv-section qstart' });
    section.appendChild(h('h3', { class: 'inv-h3', text: 'Start from a quote' }));
    section.appendChild(h('p', { class: 'inv-sublabel', style: 'margin:-2px 0 12px', text: 'Already quoted this customer? Search a quote to pull its flights, travelers and pricing straight in.' }));
    var wrap = h('div', { class: 'ac-wrap' });
    var input = h('input', { class: 'inv-input', type: 'text', placeholder: 'Search by customer, quote no. or route…', autocomplete: 'off' });
    var menu = h('div', { class: 'ac-menu', hidden: true });
    wrap.appendChild(input); wrap.appendChild(menu); section.appendChild(wrap);
    function match(q) {
      var all = state.allQuotes || [], lq = (q || '').toLowerCase();
      var list = !lq ? all : all.filter(function (x) {
        var nm = (fullName(findCustomerForDoc(x)) || x.customer_email || '').toLowerCase();
        return nm.indexOf(lq) > -1 || (x.quote_number || '').toLowerCase().indexOf(lq) > -1 || (quoteRouteLabel(x) || '').toLowerCase().indexOf(lq) > -1;
      });
      return list.slice(0, 8);
    }
    function render() {
      var list = match(input.value.trim()); menu.textContent = '';
      if (!list.length) { menu.hidden = true; return; }
      list.forEach(function (q) {
        var nm = fullName(findCustomerForDoc(q)) || q.customer_email || 'Customer';
        var sub = [q.quote_number, quoteRouteLabel(q), q.total_charged != null ? money(q.total_charged, q.currency || 'USD') : '', sqStatusLabel(q.status)].filter(Boolean).join('  ·  ');
        var row = h('div', { class: 'ac-item' }, [h('div', { class: 'ac-name', text: nm }), h('div', { class: 'ac-sub', text: sub })]);
        row.addEventListener('mousedown', function (e) { e.preventDefault(); menu.hidden = true; input.value = ''; if (target === 'itinerary') convertQuoteToItinerary(q); else convertQuoteToInvoice(q); });
        menu.appendChild(row);
      });
      menu.hidden = false;
    }
    input.addEventListener('input', render);
    input.addEventListener('focus', render);
    input.addEventListener('blur', function () { setTimeout(function () { menu.hidden = true; }, 150); });
    if (!state.allQuotes) { sb.from('quotes').select('*').order('created_at', { ascending: false }).limit(60).then(function (r) { state.allQuotes = r.data || []; if (document.activeElement === input) render(); }).catch(function (e) { console.warn('quote lookup load failed', e); }); }
    return section;
  }
  var ADAM_TAG = 'From the website chat with Adam.';
  function reqIsAdam(req) { return ('' + (req.trip || '')).indexOf(ADAM_TAG) === 0; }
  async function loadRequests() {
    var box = document.getElementById('qreq-box'); if (!box) return;
    var r = await sb.from('quote_requests').select('*').eq('status', 'new').order('created_at', { ascending: false });
    box = document.getElementById('qreq-box'); if (!box) return;
    var reqs = r.data || []; box.textContent = '';
    if (!reqs.length) { box.appendChild(emptyBox('request', 'The inbox is clear', 'New quote requests from the website and from Adam land here.')); return; }
    /* Adam-sourced requests link back to their chat; pull his brief so nothing he learned is lost */
    var briefs = {};
    var adamIds = reqs.filter(reqIsAdam).map(function (q) { return q.id; });
    if (adamIds.length) {
      try {
        var br = await sb.from('conversations').select('qr_id, brief, customer_name').in('qr_id', adamIds);
        (br.data || []).forEach(function (row) { if (row.qr_id) briefs[row.qr_id] = row; });
      } catch (e) { /* older sessions may not link */ }
      box = document.getElementById('qreq-box'); if (!box) return; box.textContent = '';
    }
    box.appendChild(h('div', { class: 'qreq-wrap' }, reqs.map(function (q) { return reqCard(q, briefs[q.id]); })));
  }
  function reqCard(req, convo) {
    var pax = (req.adults || 0) + (req.children || 0) + (req.infants || 0), bits = [];
    var isAdam = reqIsAdam(req);
    var notes = ('' + (req.trip || '')).replace(ADAM_TAG, '').trim();
    if (req.cabin) bits.push(req.cabin);
    if (pax) bits.push(pax + ' traveler' + (pax > 1 ? 's' : ''));
    if (req.depart) bits.push(req.depart + (req.return_date ? ' – ' + req.return_date : ''));
    if (req.trip_type) bits.push('Purpose: ' + req.trip_type);
    /* everything Adam extracted from the conversation, minus the empty slots */
    var briefRows = [];
    if (convo && convo.brief) {
      ('' + convo.brief).split(/\n+/).forEach(function (line) {
        var mm = line.match(/^([^:]{2,24}):\s*(.+)$/);
        if (mm && mm[2] && !/not mentioned|not given/i.test(mm[2])) briefRows.push([mm[1].trim(), mm[2].trim()]);
      });
    }
    return h('div', { class: 'qreq-card' }, [
      h('div', { class: 'qreq-top' }, [
        h('div', null, [h('div', { class: 'qreq-name', text: req.name || req.email || 'Quote request' }), h('div', { class: 'qreq-route', text: [req.route_from, req.route_to].filter(Boolean).join(' → ') })]),
        h('div', { class: 'qreq-badges' }, [
          h('span', { class: 'qreq-src' + (isAdam ? ' qreq-src--adam' : ''), text: isAdam ? 'via Adam (chat)' : 'Website form' }),
          h('span', { class: 'qreq-deliv qreq-deliv--' + (req.delivery || 'account'), text: req.delivery === 'call' ? 'Wants a call' : 'Wants it in account' })
        ])
      ]),
      bits.length ? h('div', { class: 'qreq-meta', text: bits.join('  ·  ') }) : null,
      notes ? h('div', { class: 'qreq-notes', text: notes }) : null,
      briefRows.length ? h('div', { class: 'qreq-brief' }, [h('div', { class: 'qreq-brief-h', text: 'What Adam learned' })].concat(briefRows.map(function (b) { return h('span', { class: 'qreq-brief-pill' }, [h('b', { text: b[0] }), ' ' + b[1]]); }))) : null,
      h('div', { class: 'qreq-foot' }, [
        h('div', { class: 'qreq-contact', text: [req.email, req.phone].filter(Boolean).join('  ·  ') }),
        h('div', { class: 'qreq-actions' }, [
          h('button', { type: 'button', class: 'btn btn-primary', style: 'width:auto; padding:8px 15px', onclick: function () { buildFromRequest(req); }, text: 'Link to account & build' }),
          h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto; padding:8px 13px', onclick: function () { confirmDialog({ title: 'Dismiss request', message: 'Dismiss the request from ' + (req.name || req.email || 'this visitor') + '?', detail: 'It leaves the incoming list. The customer is not notified.', danger: true, confirmText: 'Dismiss', onConfirm: function () { archiveRequest(req.id); } }); }, text: 'Dismiss' })
        ])
      ])
    ]);
  }
  function archiveRequest(id) { sb.from('quote_requests').update({ status: 'archived' }).eq('id', id).then(function () { loadRequests(); loadReqBarCount(); }).catch(function (e) { console.warn('archive request failed', e); }); }
  function parseToISODate(s) {
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    var d = new Date(s); if (isNaN(d)) return null;
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  async function afterCustomerSelected(c) {
    if (state.builderTab !== 'quote' || !c || !c.email) return;
    var r = await sb.from('quote_requests').select('*').eq('status', 'new').ilike('email', c.email).order('created_at', { ascending: false }).limit(1);
    var req = r.data && r.data[0];
    if (req) buildFromRequest(req);
  }
  function templateBar() { return h('div', { id: 'tpl-bar', class: 'tpl-bar' }); }
  async function loadTemplates() {
    var r = await sb.from('packages').select('*').order('created_at', { ascending: false });
    state.templates = r.data || [];
    renderTemplateBar();
  }
  function renderTemplateBar() {
    var bar = document.getElementById('tpl-bar'); if (!bar) return;
    bar.textContent = '';
    bar.appendChild(h('span', { class: 'tpl-bar-label', text: 'Packages' }));
    var tpls = state.templates || [];
    if (!tpls.length) bar.appendChild(h('span', { class: 'tpl-empty', text: 'None saved yet — build a trip below and save it as a package to reuse.' }));
    tpls.forEach(function (tpl) {
      var chip = h('button', { type: 'button', class: 'tpl-chip', title: 'Use this package', onclick: function () { applyTemplate(tpl); } }, [h('span', { text: tpl.name })]);
      var x = h('span', { class: 'tpl-chip-x', title: 'Delete package', text: '×' });
      x.addEventListener('click', function (e) { e.stopPropagation(); confirmDeletePackage(tpl); });
      chip.appendChild(x);
      bar.appendChild(chip);
    });
    bar.appendChild(tplSaveControl());
  }
  function tplSaveControl() {
    var wrap = h('span', { class: 'tpl-save' });
    function showButton() { wrap.textContent = ''; wrap.appendChild(h('button', { type: 'button', class: 'tpl-add', onclick: showInput, text: '+ Save current as package' })); }
    function showInput() {
      wrap.textContent = '';
      var inp = h('input', { class: 'inv-input tpl-name', type: 'text', placeholder: 'Package name', autocomplete: 'off' });
      var save = h('button', { type: 'button', class: 'btn btn-primary tpl-save-btn', style: 'width:auto; padding:7px 14px', onclick: function () { saveAsTemplate(inp.value, save); }, text: 'Save' });
      var cancel = h('button', { type: 'button', class: 'tpl-cancel', onclick: showButton, text: 'Cancel' });
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); saveAsTemplate(inp.value, save); } });
      wrap.appendChild(inp); wrap.appendChild(save); wrap.appendChild(cancel);
      setTimeout(function () { inp.focus(); }, 0);
    }
    showButton();
    return wrap;
  }
  async function saveAsTemplate(name, btn) {
    name = (name || '').trim(); if (!name) return;
    var d;
    if (state.tab === 'grouptrips') { gtCollectAll(); var gg = state.gt; d = { title: gg.title, destination: gg.destination, segments: gg.shared.segments, hotels: gg.shared.hotels, transport: gg.shared.transport, entertainment: gg.shared.entertainment, line_items: [], pax_adults: 2, pax_children: 0, pax_infants: 0, currency: gg.currency, comparable_total: gg.comparable_total }; }
    else d = state.builderTab === 'itinerary' ? collectItin() : collectDraft();
    var payload = { name: name, title: d.title || null, destination: d.destination || null, segments: d.segments || [], line_items: d.line_items || [], hotels: d.hotels || [], transport: d.transport || [], entertainment: d.entertainment || [], pax_adults: d.pax_adults, pax_children: d.pax_children, pax_infants: d.pax_infants, currency: d.currency || 'USD', comparable_total: d.comparable_total || null, notes: d.notes || null };
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }
    var r = await sb.from('packages').insert(payload).select().maybeSingle();
    if (r.error) { if (btn) { btn.disabled = false; btn.textContent = 'Save'; } return; }
    await loadTemplates();
  }
  /* ---- reusable confirm dialog (delete guard) ---- */
  function confirmDialog(opts) {
    opts = opts || {};
    var node = h('div', { class: 'adm-confirm' }, [
      h('p', { class: 'adm-confirm-msg', text: opts.message || 'Are you sure?' }),
      opts.detail ? h('p', { class: 'adm-confirm-detail', text: opts.detail }) : null,
      h('div', { class: 'adm-confirm-actions' }, [
        h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto', onclick: closeAdminOverlay, text: opts.cancelText || 'Cancel' }),
        h('button', { type: 'button', class: 'btn ' + (opts.danger ? 'btn-danger' : 'btn-primary'), style: 'width:auto', onclick: function () { closeAdminOverlay(); if (opts.onConfirm) opts.onConfirm(); }, text: opts.confirmText || 'Delete' })
      ])
    ]);
    adminOverlay(node, opts.title || 'Please confirm');
  }
  function confirmDeletePackage(pkg) {
    confirmDialog({
      title: 'Delete package',
      message: 'Delete “' + (pkg.name || 'this package') + '”?',
      detail: 'This removes the saved package. Any quotes or itineraries already built from it are not affected.',
      danger: true, confirmText: 'Delete package',
      onConfirm: function () { doDeletePackage(pkg.id); }
    });
  }
  async function doDeletePackage(id) {
    try { await sb.from('packages').delete().eq('id', id); } catch (e) { console.warn('delete package failed', e); }
    if (document.getElementById('pkg-list')) loadPackagesList();
    if (document.getElementById('tpl-bar')) loadTemplates();
  }
  /* ---- Packages: dedicated section (build + save a reusable trip) ---- */
  function tabPackages() {
    var wrap = h('div');
    if (state.pkgView === 'form') {
      var editing = !!(state.pkgDraft && state.pkgDraft.id);
      wrap.appendChild(mainHead(editing ? 'Edit package' : 'New package', 'Build a reusable trip — flights, hotels, transport and experiences. Drop it into any quote or itinerary later.'));
      var fbody = h('div', { class: 'main-body' });
      if (state.pkgFlash) { fbody.appendChild(flashEl(state.pkgFlash, true)); state.pkgFlash = null; }
      fbody.appendChild(packageForm(state.pkgDraft));
      wrap.appendChild(fbody);
      return wrap;
    }
    wrap.appendChild(mainHead('Packages', 'Reusable trips you build once and drop into any quote or itinerary. Create one here and it saves to your library.'));
    var body = h('div', { class: 'main-body' });
    if (state.pkgFlash) { body.appendChild(flashEl(state.pkgFlash, true)); state.pkgFlash = null; }
    body.appendChild(h('button', { class: 'btn btn-primary', style: 'width:auto; margin-bottom:18px', onclick: function () { state.pkgView = 'form'; state.pkgDraft = null; renderTab(); }, text: '+ New package' }));
    body.appendChild(h('div', { id: 'pkg-list', class: 'pkg-list' }, [h('div', { class: 'dash-loading', text: 'Loading packages…' })]));
    wrap.appendChild(body);
    setTimeout(loadPackagesList, 0);
    return wrap;
  }
  async function loadPackagesList() {
    var r = await sb.from('packages').select('*').order('created_at', { ascending: false });
    state.templates = r.data || [];
    var box = document.getElementById('pkg-list'); if (!box) return;
    box.textContent = '';
    var pkgs = state.templates;
    if (!pkgs.length) { box.appendChild(emptyBox('package', 'No packages yet', 'Build a reusable trip once and drop it into any quote or itinerary.')); return; }
    pkgs.forEach(function (pkg) { box.appendChild(packageCard(pkg)); });
  }
  function packageCard(pkg) {
    var segs = pkg.segments || [], hotels = pkg.hotels || [], trans = pkg.transport || [], ent = pkg.entertainment || [];
    var bits = [];
    if (segs.length) bits.push(segs.length + (segs.length === 1 ? ' flight' : ' flights'));
    if (hotels.length) bits.push(hotels.length + (hotels.length === 1 ? ' hotel' : ' hotels'));
    if (trans.length) bits.push(trans.length + (trans.length === 1 ? ' transfer' : ' transfers'));
    if (ent.length) bits.push(ent.length + (ent.length === 1 ? ' experience' : ' experiences'));
    return h('div', { class: 'pkg-card' }, [
      h('div', { class: 'pkg-card-main' }, [
        h('div', { class: 'pkg-card-name', text: pkg.name || 'Untitled package' }),
        h('div', { class: 'pkg-card-sub', text: [pkg.destination, bits.join('  ·  ')].filter(Boolean).join('  —  ') || 'Empty package' }),
        pkg.comparable_total ? h('div', { class: 'pkg-card-price', text: 'Comparable ' + money(dnum(pkg.comparable_total), pkg.currency) }) : null
      ]),
      h('div', { class: 'pkg-card-actions' }, [
        h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto', onclick: function () { state.pkgView = 'form'; state.pkgDraft = pkg; renderTab(); }, text: 'Edit' }),
        h('button', { type: 'button', class: 'btn btn-ghost pkg-del-btn', style: 'width:auto', onclick: function () { confirmDeletePackage(pkg); }, text: 'Delete' })
      ])
    ]);
  }
  function packageForm(d) {
    d = d || {};
    state.pkgBuilding = true;
    var segs = (d.segments && d.segments.length) ? d.segments : [null];
    var form = h('form', { class: 'inv-form', onsubmit: function (e) { e.preventDefault(); savePackageForm(); } }, [
      h('div', { class: 'inv-section' }, [
        h('h3', { class: 'inv-h3', text: 'Package' }),
        h('div', { class: 'inv-row2' }, [invField('Package name', 'pkg-name', 'text', 'e.g. Dubai First Class · 5 nights', d.name), cityField('Destination', '', d.destination, 'Start typing a city…', 'pkg-dest')]),
        invField('Display title (optional)', 'pkg-title', 'text', 'Shown on the trip, e.g. Dubai First Class Getaway', d.title),
        h('p', { class: 'inv-sublabel', style: 'margin-top:16px', text: 'Default travelers' }),
        h('div', { class: 'inv-row3' }, [paxField('Adults (12+)', 'pkg-adults', d.pax_adults != null ? d.pax_adults : 2), paxField('Children (2–11)', 'pkg-children', d.pax_children != null ? d.pax_children : 0), paxField('Infants (under 2)', 'pkg-infants', d.pax_infants != null ? d.pax_infants : 0)])
      ]),
      h('div', { class: 'inv-section' }, [h('h3', { class: 'inv-h3', text: 'Flights' }), flightsSection(segs, detectTripType(d))]),
      itinSection('Hotels', 'itin-hotels', (d.hotels || []).map(hotelCard), '+ Add hotel', function () { var c = hotelCard(); document.getElementById('itin-hotels').appendChild(c); initDatePickers(c); }),
      itinSection('Transportation', 'itin-transport', (d.transport || []).map(transportCard), '+ Add transport', function () { var c = transportCard(); document.getElementById('itin-transport').appendChild(c); initDatePickers(c); }),
      itinSection('Dining', 'itin-dining', (d.entertainment || []).filter(function (x) { return x.kind === 'dining'; }).map(diningCard), '+ Add dining', function () { var c = diningCard(); document.getElementById('itin-dining').appendChild(c); initDatePickers(c); }),
      itinSection('Entertainment', 'itin-ent', (d.entertainment || []).filter(function (x) { return x.kind !== 'dining'; }).map(entCard), '+ Add experience', function () { var c = entCard(); document.getElementById('itin-ent').appendChild(c); initDatePickers(c); }),
      h('div', { class: 'inv-section' }, [
        h('h3', { class: 'inv-h3', text: 'Pricing (optional)' }),
        h('p', { class: 'inv-sublabel', style: 'margin:-2px 0 14px', text: 'A typical retail/comparable price. Used to show savings when this package becomes a trip.' }),
        h('div', { class: 'inv-row2' }, [invField('Comparable / retail price', 'pkg-comp', 'number', '0.00', d.comparable_total), h('div')]),
        h('input', { type: 'hidden', id: 'pkg-cur', value: d.currency || (state.settings && state.settings.default_currency) || 'USD' })
      ]),
      h('div', { class: 'inv-section' }, [h('h3', { class: 'inv-h3', text: 'Notes (optional)' }), h('textarea', { id: 'pkg-notes', class: 'inv-input inv-textarea', rows: '2', placeholder: 'Anything to remember about this package.', value: d.notes || '' })]),
      h('div', { class: 'inv-submit' }, [
        h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto; padding:13px 24px', onclick: function () { confirmDialog({ title: 'Leave package', message: 'Leave without saving this package?', detail: 'Anything typed here is lost.', danger: true, confirmText: 'Leave', onConfirm: function () { state.pkgBuilding = false; state.pkgView = 'list'; state.pkgDraft = null; renderTab(); } }); }, text: 'Cancel' }),
        h('div', { id: 'pkg-msg', class: 'msg', style: 'display:none' }),
        h('button', { type: 'submit', class: 'btn btn-primary', style: 'width:auto; padding:13px 30px', text: (d && d.id) ? 'Save changes' : 'Save package' })
      ])
    ]);
    setTimeout(function () { applyTripType(detectTripType(d)); initDatePickers(form); }, 0);
    return form;
  }
  function collectPackage() {
    var pa = parseInt(val('pkg-adults'), 10); if (isNaN(pa)) pa = 0;
    var pc = parseInt(val('pkg-children'), 10) || 0, pi = parseInt(val('pkg-infants'), 10) || 0;
    return {
      name: (val('pkg-name') || '').trim(),
      title: val('pkg-title') || null,
      destination: val('pkg-dest') || null,
      pax_adults: pa, pax_children: pc, pax_infants: pi,
      segments: readSegments(),
      hotels: readCards('itin-hotels', 'hotel'),
      transport: readCards('itin-transport', 'transport'),
      entertainment: readCards('itin-dining', 'dining').concat(readCards('itin-ent', 'ent')),
      line_items: [],
      comparable_total: parseFloat(val('pkg-comp')) || null,
      currency: val('pkg-cur') || (state.settings && state.settings.default_currency) || 'USD',
      notes: val('pkg-notes') || null
    };
  }
  async function savePackageForm() {
    var msg = document.getElementById('pkg-msg');
    var d = collectPackage();
    if (!d.name) { if (msg) showInvMsg(msg, 'Give the package a name so you can find it later.', 'err'); return; }
    var editing = !!(state.pkgDraft && state.pkgDraft.id);
    var r;
    try {
      if (editing) r = await sb.from('packages').update(d).eq('id', state.pkgDraft.id).select().maybeSingle();
      else r = await sb.from('packages').insert(d).select().maybeSingle();
    } catch (e) { r = { error: e }; }
    if (r && r.error) { if (msg) showInvMsg(msg, (r.error.message) || 'Could not save the package.', 'err'); return; }
    state.pkgBuilding = false; state.pkgView = 'list'; state.pkgDraft = null;
    state.pkgFlash = { kind: 'ok', text: editing ? 'Package updated.' : 'Package saved to your library.' };
    renderTab();
  }
  function applyTemplate(tpl) {
    if (state.tab === 'grouptrips') {
      gtCollectAll();
      var g = state.gt;
      g.shared = { segments: tpl.segments || [], trip_type: detectTripType(tpl), hotels: tpl.hotels || [], transport: tpl.transport || [], entertainment: tpl.entertainment || [] };
      if (!g.destination && tpl.destination) g.destination = tpl.destination;
      if (!g.title && tpl.title) g.title = tpl.title;
      if (g.comparable_total == null && tpl.comparable_total != null) g.comparable_total = tpl.comparable_total;
      state.gtFlash = { kind: 'note', text: 'Loaded package "' + tpl.name + '" into the shared journey. Add each city group next.' };
      renderTab(); return;
    }
    if (state.builderTab === 'itinerary') {
      var segs = tpl.segments || [], s0 = segs[0], sN = segs[segs.length - 1];
      state.itinDraft = { title: tpl.title || '', destination: tpl.destination || '', start_date: s0 ? s0.depart_date : null, end_date: sN ? (sN.return_date || sN.depart_date) : null, pax_adults: tpl.pax_adults != null ? tpl.pax_adults : 1, pax_children: tpl.pax_children || 0, pax_infants: tpl.pax_infants || 0, segments: segs, hotels: tpl.hotels || [], transport: tpl.transport || [], entertainment: tpl.entertainment || [], notes: tpl.notes || '' };
      state.itinFlash = { kind: 'note', text: 'Loaded package "' + tpl.name + '". Pick a customer and adjust as needed.' };
      state.itinView = 'form';
    } else {
      state.docDraft = { title: tpl.title || '', destination: tpl.destination || '', segments: tpl.segments || [], pax_adults: tpl.pax_adults != null ? tpl.pax_adults : 1, pax_children: tpl.pax_children || 0, pax_infants: tpl.pax_infants || 0, line_items: tpl.line_items || [], currency: tpl.currency || 'USD', comparable_total: tpl.comparable_total || null, notes: tpl.notes || '' };
      state.docFlash = { kind: 'note', text: 'Loaded package "' + tpl.name + '". Pick a customer and adjust as needed.' };
      state.docView = 'form';
    }
    renderTab();
  }
  function buildFromRequest(req) {
    var cust = null;
    if (req.email) { for (var i = 0; i < state.customers.length; i++) { if ((state.customers[i].email || '').toLowerCase() === req.email.toLowerCase()) { cust = state.customers[i]; break; } } }
    if (!cust) cust = { id: null, email: req.email || '', first_name: req.name || req.email || 'Guest', last_name: '', account_number: null };
    state.docCustomer = cust;
    function resolve(txt) {
      if (!txt) return null;
      var A = window.UT_AIRPORTS || [], c, j;
      var raw = ('' + txt).trim();
      /* the site sends "Los Angeles International Airport (LAX)": the code in parentheses is
         the truth. NEVER grab the first 3-letter word of the name (LOS ANGELES matched Lagos). */
      var paren = raw.toUpperCase().match(/\(([A-Z0-9]{3})\)/);
      var code = (paren && paren[1]) || (/^[A-Za-z]{3}$/.test(raw) ? raw.toUpperCase() : null);
      if (code) { for (j = 0; j < A.length; j++) { if (A[j][0] === code) { c = A[j]; break; } } }
      if (!c) {
        var nameOnly = raw.replace(/\s*\([^)]*\)\s*/g, ' ').trim(), low = nameOnly.toLowerCase();
        var a = searchAirports(nameOnly);
        for (j = 0; j < a.length; j++) { if ((a[j][3] || '').toLowerCase() === low) { c = a[j]; break; } }
        if (!c) for (j = 0; j < a.length; j++) { if ((a[j][3] || '').toLowerCase().indexOf(low) > -1) { c = a[j]; break; } }
        if (!c) for (j = 0; j < a.length; j++) { if (/international|intercontinental/i.test(a[j][3] || '')) { c = a[j]; break; } }
        if (!c && a.length) c = a[0];
      }
      return c ? { code: c[0], city: c[1], country: c[2], name: c[3] } : null;
    }
    var f = resolve(req.route_from), t = resolve(req.route_to);
    var pd = parseToISODate(req.depart), rd = parseToISODate(req.return_date);
    /* quote_requests.trip_type holds the travel PURPOSE (Personal/Business), not the shape; a return date means round trip */
    var tt = rd ? 'round' : 'one_way';
    var segs = [];
    if (f && t) {
      segs.push({ airline: null, cabin: req.cabin || 'Business Class', from: f, to: t, depart_date: pd });
      if (tt === 'round') segs.push({ airline: null, cabin: req.cabin || 'Business Class', from: t, to: f, depart_date: rd });
    }
    state.builderTab = 'quote'; state.docKind = 'quote';
    state.docDraft = { request_id: req.id, title: [req.route_from, req.route_to].filter(Boolean).join(' to '), trip_type: tt, segments: segs, pax_adults: req.adults != null ? req.adults : 1, pax_children: req.children || 0, pax_infants: req.infants || 0, line_items: [], currency: 'USD' };
    state.docFlash = { kind: 'note', text: 'Pre-filled from a quote request submitted ' + fmtDate(req.created_at) + '.' };
    state.docView = 'form'; renderTab();
    if (!cust.id && req.email) {
      setTimeout(function () {
        confirmDialog({ title: 'No account yet', message: req.email + ' has no customer account. Create one now?', detail: 'The account is created instantly and this quote lands in it. They set their own password from the sign-in page.', confirmText: 'Create account', onConfirm: function () { createCustomerFromRequest(req); } });
      }, 60);
    }
  }
  async function createCustomerFromRequest(req) {
    var nm = (req.name || '').trim().split(/\s+/);
    var body = { email: req.email, first_name: nm[0] || '', last_name: nm.slice(1).join(' ') || '', phone: req.phone || '' };
    var r; try { r = await sb.functions.invoke('admin-create-customer', { body: body }); } catch (e) { r = { error: e }; }
    var errMsg = (r.error && r.error.message) || (r.data && r.data.error);
    if (errMsg) { state.docFlash = { kind: 'err', text: 'Could not create the account: ' + errMsg }; renderTab(); return; }
    await loadCustomers();
    var made = null;
    for (var i = 0; i < state.customers.length; i++) { if ((state.customers[i].email || '').toLowerCase() === req.email.toLowerCase()) { made = state.customers[i]; break; } }
    if (made) state.docCustomer = made;
    state.docFlash = { kind: 'ok', text: 'Account created for ' + req.email + ' and linked to this quote.' };
    renderTab();
  }
  function tabDoc() {
    var c = dcfg(), wrap = h('div');
    if (state.docView === 'review' && state.docDraft) { wrap.appendChild(mainHead(c.reviewTitle, 'Check everything, then send it to the customer.')); wrap.appendChild(h('div', { class: 'main-body' }, [reviewDoc(state.docDraft)])); return wrap; }
    if (state.docView === 'requests') {
      wrap.appendChild(mainHead('Incoming requests', 'Quote requests from the website, waiting to be built.'));
      var rb = h('div', { class: 'main-body' });
      rb.appendChild(h('button', { class: 'btn btn-ghost', style: 'width:auto; margin-bottom:18px', onclick: function () { state.docView = 'form'; renderTab(); }, text: '← Back to quotes' }));
      rb.appendChild(h('div', { id: 'qreq-box' }, [h('div', { class: 'dash-loading', text: 'Loading requests…' })]));
      wrap.appendChild(rb); setTimeout(loadRequests, 0); return wrap;
    }
    if (state.docView === 'list') {
      var isInv = c.head === 'INVOICE';
      wrap.appendChild(mainHead(isInv ? 'Invoices' : 'Quotes', isInv ? 'View or edit any invoice you’ve sent.' : 'View or edit any quote you’ve sent.'));
      var lb = h('div', { class: 'main-body' });
      lb.appendChild(h('button', { class: 'btn btn-ghost', style: 'width:auto; margin-bottom:14px', onclick: function () { state.docView = 'form'; state.docDraft = null; state.draftId = null; renderTab(); }, text: isInv ? '← New invoice' : '← New quote' }));
      var dsearch = h('input', { class: 'inv-input list-search', type: 'text', placeholder: isInv ? 'Search invoices by customer, number or route…' : 'Search quotes by customer, number or route…', autocomplete: 'off', value: (isInv ? state.invSearch : state.qSearch) || '' });
      dsearch.addEventListener('input', function () { if (isInv) { state.invSearch = dsearch.value; renderInvoiceList(); } else { state.qSearch = dsearch.value; renderSentQuotes(); } });
      lb.appendChild(dsearch);
      lb.appendChild(h('div', { id: isInv ? 'invlist-box' : 'sentq-box' }, [h('div', { class: 'dash-loading', text: isInv ? 'Loading invoices…' : 'Loading quotes…' })]));
      wrap.appendChild(lb); setTimeout(isInv ? loadInvoiceList : loadSentQuotes, 0); return wrap;
    }
    wrap.appendChild(mainHead(c.title, c.sub));
    var body = h('div', { class: 'main-body' });
    if (state.docFlash) { body.appendChild(flashEl(state.docFlash)); state.docFlash = null; }
    body.appendChild(draftsBar(state.docKind));
    body.appendChild(docForm(state.docDraft));
    wrap.appendChild(body); return wrap;
  }
  function invInput(id, type, ph, value) { var a = { id: id, class: 'inv-input', type: type || 'text', placeholder: ph || '' }; if (type === 'number') { a.step = '0.01'; a.min = '0'; } if (value != null) a.value = value; return h('input', a); }
  function invField(label, id, type, ph, value) { return h('label', { class: 'inv-field' }, [h('span', { text: label }), invInput(id, type, ph, value)]); }
  function lineRow(it) {
    return h('div', { class: 'inv-line' }, [
      h('input', { class: 'inv-input inv-line-label', type: 'text', placeholder: 'Description — e.g. Emirates First, JFK to DXB ×2', value: (it && it.label) || '' }),
      h('input', { class: 'inv-input inv-line-detail', type: 'text', placeholder: 'Detail (optional)', value: (it && it.detail) || '' }),
      h('input', { class: 'inv-input inv-line-amt', type: 'number', step: '0.01', min: '0', placeholder: '0.00', value: (it && it.amount != null) ? it.amount : '', oninput: recalc }),
      h('button', { type: 'button', class: 'inv-line-rm', title: 'Remove', onclick: function (e) { var c = document.getElementById('inv-lines'); if (c.querySelectorAll('.inv-line').length > 1) e.target.closest('.inv-line').remove(); recalc(); }, text: '×' })
    ]);
  }
  function currencySelect(cur) { return styledSelect('inv-cur', cur || (state.settings && state.settings.default_currency) || 'USD', CURRENCIES.map(function (c) { return { v: c.code, l: c.name, r: c.sym, b: c.code + '  ' + c.sym }; }), recalc); }
  function totalRow(label, id, big) { return h('div', { class: 'inv-total' + (big ? ' inv-total-big' : '') }, [h('span', { class: 'inv-total-k', text: label }), h('span', { class: 'inv-total-v', id: id, text: '—' })]); }
  function quotePkgSections(d) {
    d = d || {};
    return h('div', { class: 'quote-pkg' }, [
      h('div', { class: 'inv-section quote-pkg-lead' }, [h('p', { class: 'inv-sublabel', style: 'margin:0', text: 'Optional — build out the whole package. Everything here shows on the quote; booking references and seat numbers are only asked for later, on the itinerary.' })]),
      itinSection('Hotels', 'itin-hotels', (d.hotels || []).map(hotelCard), '+ Add hotel', function () { var c = hotelCard(); document.getElementById('itin-hotels').appendChild(c); initDatePickers(c); }),
      itinSection('Transportation', 'itin-transport', (d.transport || []).map(transportCard), '+ Add transport', function () { var c = transportCard(); document.getElementById('itin-transport').appendChild(c); initDatePickers(c); }),
      itinSection('Dining', 'itin-dining', (d.entertainment || []).filter(function (x) { return x.kind === 'dining'; }).map(diningCard), '+ Add dining', function () { var c = diningCard(); document.getElementById('itin-dining').appendChild(c); initDatePickers(c); }),
      itinSection('Experiences', 'itin-ent', (d.entertainment || []).filter(function (x) { return x.kind !== 'dining'; }).map(entCard), '+ Add experience', function () { var c = entCard(); document.getElementById('itin-ent').appendChild(c); initDatePickers(c); }),
      itinSection('Cruises', 'itin-cruises', (d.cruises || []).map(cruiseCard), '+ Add cruise', function () { var c = cruiseCard(); document.getElementById('itin-cruises').appendChild(c); initDatePickers(c); })
    ]);
  }
  function docForm(d) {
    d = d || {};
    var segs = (d.segments && d.segments.length) ? d.segments : [null];
    var lines = (d.line_items && d.line_items.length) ? d.line_items : [null];
    var custBox = h('div', { id: 'inv-cust', class: 'inv-cust' });
    var pricingRow2 = state.docKind === 'quote'
      ? h('div', { class: 'inv-row2' }, [invField('Valid until', 'inv-valid', 'date', '', d.valid_until || (!d.editing_id ? addDays(todayISO(), (state.settings && parseInt(state.settings.quote_validity_days, 10)) || 14) : '')), h('div')])
      : h('div', { class: 'inv-row2' }, [
          h('label', { class: 'inv-field' }, [h('span', { text: 'Deposit paid (optional)' }), h('div', { class: 'itin-pull-row' }, [invInput('inv-deposit', 'number', '0.00', d.deposit_paid), (state.settings && parseFloat(state.settings.deposit_pct) > 0) ? h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto; padding:0 14px; height:46px; white-space:nowrap', title: 'Fill from the default deposit percentage', onclick: fillDepositPct, text: parseFloat(state.settings.deposit_pct) + '%' }) : null])]),
          invField('Balance due by (optional)', 'inv-due', 'date', '', d.due_date)
        ]);
    var costRow = state.docKind === 'invoice'
      ? h('div', { class: 'inv-row2' }, [
          h('label', { class: 'inv-field' }, [h('span', { text: 'Your cost — net fare (private)' }), h('input', { id: 'inv-cost', class: 'inv-input', type: 'number', step: '0.01', min: '0', placeholder: '0.00', value: d.net_cost != null ? d.net_cost : '', oninput: recalc })]),
          h('label', { class: 'inv-field' }, [h('span', { text: 'Your profit' }), h('div', { class: 'inv-profit', id: 'inv-profit', text: '—' })])
        ])
      : null;
    var form = h('form', { class: 'inv-form', onsubmit: toReviewDoc }, [
      templateBar(),
      state.docKind === 'invoice' ? quoteStartBar('invoice') : null,
      h('div', { class: 'inv-section' }, [h('h3', { class: 'inv-h3', text: 'Customer' }), customerSearch(), custBox]),
      h('div', { class: 'inv-section' }, [
        h('h3', { class: 'inv-h3', text: 'Trip' }),
        invField('Trip title', 'inv-title', 'text', 'e.g. Dubai First Class Getaway', d.title),
        h('p', { class: 'inv-sublabel', text: 'Flights' }),
        flightsSection(segs, detectTripType(d)),
        h('p', { class: 'inv-sublabel', style: 'margin-top:18px', text: 'Travelers' }),
        h('div', { class: 'inv-row3' }, [paxField('Adults (12+)', 'inv-adults', d.pax_adults != null ? d.pax_adults : 1), paxField('Children (2–11)', 'inv-children', d.pax_children != null ? d.pax_children : 0), paxField('Infants (under 2)', 'inv-infants', d.pax_infants != null ? d.pax_infants : 0)]),
        h('div', { style: 'margin-top:14px' }, [invField('Booking reference (optional)', 'inv-ref', 'text', 'PNR / confirmation', d.booking_reference)])
      ]),
      state.docKind === 'quote' ? quotePkgSections(d) : null,
      h('div', { class: 'inv-section' }, [
        h('h3', { class: 'inv-h3', text: 'Line items' }),
        h('div', { class: 'inv-line-head' }, [h('span', { text: 'Description' }), h('span', { text: 'Detail' }), h('span', { text: 'Amount' }), h('span')]),
        h('div', { id: 'inv-lines', class: 'inv-lines' }, lines.map(lineRow)),
        h('div', { class: 'inv-line-actions' }, [
          h('button', { type: 'button', class: 'inv-addline', onclick: function () { document.getElementById('inv-lines').appendChild(lineRow()); }, text: '+ Add line item' }),
          h('button', { type: 'button', class: 'inv-genline', onclick: fillFromFlights, text: 'Generate from flights' })
        ]),
        h('p', { class: 'inv-gen-note', id: 'inv-gen-note', style: 'display:none' })
      ]),
      h('div', { class: 'inv-section' }, [
        h('h3', { class: 'inv-h3', text: 'Pricing & savings' }),
        h('div', { class: 'inv-row2' }, [h('label', { class: 'inv-field' }, [h('span', { text: 'Currency' }), currencySelect(d.currency)]), invField('Comparable price (booked elsewhere)', 'inv-comp', 'number', '0.00', d.comparable_total)]),
        pricingRow2,
        (state.docKind === 'invoice') ? h('div', { class: 'inv-field', style: 'margin-top:16px' }, [
          h('span', { text: 'Payment options shown on this invoice' }),
          payMethodDefs().length
            ? h('div', { class: 'payopt-list' }, payMethodDefs().map(function (m) {
                var on = d.payment_methods ? d.payment_methods.indexOf(m[0]) > -1 : true;
                return h('label', { class: 'payopt' }, [h('input', { type: 'checkbox', class: 'payopt-cb', value: m[0], checked: on ? '' : null }), h('span', { text: m[1] })]);
              }))
            : h('div', { class: 'payopt-none' }, [
                h('span', { text: 'No payment methods set up yet. ' }),
                h('button', { type: 'button', class: 'payopt-go', onclick: function () { state.tab = 'settings'; refreshNav(); renderTab(); }, text: 'Add them in Settings → Getting paid' })
              ])
        ]) : null,
        costRow,
        h('div', { class: 'inv-totals' }, [totalRow('Total', 'inv-t-charged'), totalRow('Comparable', 'inv-t-comp'), totalRow('You saved', 'inv-t-saved', true)])
      ]),
      state.docKind === 'quote' ? quoteOptionsSection(d.options) : null,
      h('div', { class: 'inv-section' }, [h('h3', { class: 'inv-h3', text: 'Notes (optional)' }), h('textarea', { id: 'inv-notes', class: 'inv-input inv-textarea', rows: '2', placeholder: 'Anything the customer should know.', value: d.notes || '' })]),
      h('div', { class: 'inv-submit' }, [h('span', { id: 'draft-ind', class: 'draft-ind', text: 'Auto-saving to this customer' }), h('div', { id: 'inv-msg', class: 'msg', style: 'display:none' }), h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto', onclick: function (e) { saveDraftNow(e.target); }, text: 'Save draft' }), h('button', { type: 'submit', class: 'btn btn-primary', style: 'width:auto; padding:13px 30px', text: 'Create & review' })])
    ]);
    setTimeout(function () { if (state.docCustomer) renderResolved(state.docCustomer); recalc(); loadTemplates(); applyTripType(detectTripType(d)); initDatePickers(form); }, 0);
    return form;
  }
  function fillDepositPct() {
    var pct = (state.settings && parseFloat(state.settings.deposit_pct)) || 0; if (!pct) return;
    var total = 0;
    Array.prototype.forEach.call(document.querySelectorAll('#inv-lines .inv-line-amt'), function (el) { var v = parseFloat(el.value); if (!isNaN(v)) total += v; });
    var dep = document.getElementById('inv-deposit'); if (!dep) return;
    dep.value = (Math.round(total * pct) / 100).toFixed(2);
    recalc();
  }
  function recalc() {
    var total = 0;
    Array.prototype.forEach.call(document.querySelectorAll('#inv-lines .inv-line-amt'), function (i) { var v = parseFloat(i.value); if (!isNaN(v)) total += v; });
    var comp = parseFloat(val('inv-comp')); if (isNaN(comp)) comp = 0;
    var cur = val('inv-cur') || 'USD';
    setText('inv-t-charged', money(total, cur)); setText('inv-t-comp', comp ? money(comp, cur) : '—'); setText('inv-t-saved', money(Math.max(comp - total, 0), cur));
    var pe = document.getElementById('inv-profit'); if (pe) { var cost = parseFloat(val('inv-cost')) || 0; pe.textContent = money(total - cost, cur); }
  }
  function showInvMsg(el, text, kind) { el.className = 'msg ' + kind; el.textContent = text; el.style.display = 'block'; }
  /* multi-option quotes: alternatives the customer can pick between (label, blurb, price) */
  function quoteOptRow(o) {
    o = o || {};
    return h('div', { class: 'qo-row' }, [
      h('input', { class: 'inv-input qo-label', type: 'text', placeholder: 'Option name, e.g. Qatar Business', autocomplete: 'off', value: o.label || '' }),
      h('input', { class: 'inv-input qo-desc', type: 'text', placeholder: 'One-line description (optional)', autocomplete: 'off', value: o.desc || '' }),
      h('input', { class: 'inv-input qo-total', type: 'number', min: '0', step: '0.01', placeholder: 'Price', value: o.total != null ? o.total : '' }),
      h('input', { class: 'inv-input qo-comp', type: 'number', min: '0', step: '0.01', placeholder: 'Comparable', value: o.comparable != null ? o.comparable : '' }),
      h('button', { type: 'button', class: 'inv-line-rm', title: 'Remove option', onclick: function (e) { e.target.closest('.qo-row').remove(); }, text: '\u00d7' })
    ]);
  }
  function quoteOptionsSection(options) {
    return h('div', { class: 'inv-section' }, [
      h('h3', { class: 'inv-h3', text: 'Alternative options (optional)' }),
      h('p', { class: 'inv-sublabel', style: 'margin:-2px 0 12px', text: 'Give the customer a choice, like Option B on a different airline or cabin. The pricing above stays the lead offer; the customer accepts whichever they prefer.' }),
      h('div', { class: 'qo-head' }, [h('span', { text: 'Option' }), h('span', { text: 'Description' }), h('span', { text: 'Price' }), h('span', { text: 'Comparable' }), h('span')]),
      h('div', { id: 'q-opts' }, (options || []).map(quoteOptRow)),
      h('button', { type: 'button', class: 'inv-addline', onclick: function () { document.getElementById('q-opts').appendChild(quoteOptRow()); }, text: '+ Add an option' })
    ]);
  }
  function readQuoteOptions() {
    var out = [];
    Array.prototype.forEach.call(document.querySelectorAll('#q-opts .qo-row'), function (r) {
      var label = (r.querySelector('.qo-label') || {}).value || '', total = parseFloat((r.querySelector('.qo-total') || {}).value);
      label = label.trim();
      if (!label || isNaN(total)) return;
      var comp = parseFloat((r.querySelector('.qo-comp') || {}).value);
      out.push({ label: label, desc: ((r.querySelector('.qo-desc') || {}).value || '').trim() || null, total: total, comparable: isNaN(comp) ? null : comp });
    });
    return out;
  }
  /* the ways dad can get paid, from Settings; only configured ones are offerable */
  function payMethodDefs() {
    var st = state.settings || {};
    return [
      ['wire', 'Wire / bank transfer', st.payment_details],
      ['stripe', 'Card (Stripe link)', st.pay_stripe],
      ['paypal', 'PayPal', st.pay_paypal],
      ['zelle', 'Zelle', st.pay_zelle]
    ].filter(function (m) { return ('' + (m[2] || '')).trim(); });
  }
  function collectDraft() {
    var items = [];
    Array.prototype.forEach.call(document.querySelectorAll('#inv-lines .inv-line'), function (r) {
      var label = r.querySelector('.inv-line-label').value.trim(), detail = r.querySelector('.inv-line-detail').value.trim(), amt = parseFloat(r.querySelector('.inv-line-amt').value);
      if (label && !isNaN(amt)) items.push({ label: label, detail: detail || null, amount: amt });
    });
    var segs = readSegments();
    var tripType = readTripType();
    var pa = parseInt(val('inv-adults'), 10); if (isNaN(pa)) pa = 0;
    var pc = parseInt(val('inv-children'), 10) || 0, pi = parseInt(val('inv-infants'), 10) || 0;
    var dest = segs.length ? (segs[0].to.city + ', ' + segs[0].to.country) : null;
    var qpkg = state.docKind === 'quote' ? { hotels: readCards('itin-hotels', 'hotel'), transport: readCards('itin-transport', 'transport'), entertainment: readCards('itin-dining', 'dining').concat(readCards('itin-ent', 'ent')), cruises: readCards('itin-cruises', 'cruise') } : { hotels: [], transport: [], entertainment: [], cruises: [] };
    return { customer: state.docCustomer, request_id: state.docDraft && state.docDraft.request_id || null, source_quote_id: state.docDraft && state.docDraft.source_quote_id || null, editing_id: state.docDraft && state.docDraft.editing_id || null, editing_number: state.docDraft && state.docDraft.editing_number || null, title: val('inv-title'), destination: dest, trip_type: tripType, segments: segs, hotels: qpkg.hotels, transport: qpkg.transport, entertainment: qpkg.entertainment, cruises: qpkg.cruises, pax_adults: pa, pax_children: pc, pax_infants: pi, passengers: (pa + pc + pi) || 1, booking_reference: val('inv-ref'), line_items: items, currency: val('inv-cur') || 'USD', comparable_total: parseFloat(val('inv-comp')) || null, deposit_paid: parseFloat(val('inv-deposit')) || null, net_cost: parseFloat(val('inv-cost')) || null, due_date: val('inv-due') || null, valid_until: val('inv-valid') || null, options: readQuoteOptions(), payment_methods: state.docKind === 'invoice' ? Array.prototype.map.call(document.querySelectorAll('.payopt-cb:checked'), function (el) { return el.value; }) : undefined, notes: val('inv-notes') };
  }
  /* a "round trip" with only one filled flight would silently send as a one-way — stop it */
  function roundTripGap(d) { return d.trip_type === 'round' && (d.segments || []).length === 1; }
  var RT_GAP_MSG = 'This is set to Round trip but only one flight is filled in. Fill in the return flight (airports at minimum), or switch the trip type to One way.';
  function toReviewDoc(e) {
    e.preventDefault();
    var msg = document.getElementById('inv-msg');
    if (!state.docCustomer) { showInvMsg(msg, 'Find and confirm a customer first.', 'err'); return; }
    var d = collectDraft();
    if (!d.line_items.length) { showInvMsg(msg, 'Add at least one line item with a description and amount.', 'err'); return; }
    if (roundTripGap(d)) { showInvMsg(msg, RT_GAP_MSG, 'err'); return; }
    if (!d.title) d.title = autoTitle(d);
    state.docDraft = d; state.docView = 'review'; renderTab();
  }
  function tline(k, v, due) { return h('div', { class: 'rev-tline' + (due ? ' rev-tline-due' : '') }, [h('span', { text: k }), h('span', { text: v })]); }
  function pkgReviewInto(docEl, d) {
    function sec(title, arr, lineFn) { if (!arr || !arr.length) return; docEl.appendChild(h('div', { class: 'rev-routing' }, [h('h4', { class: 'rev-h4', text: title }), h('div', { class: 'rev-segs' }, arr.map(lineFn))])); }
    sec('Hotels', d.hotels, function (x) { return h('div', { class: 'rev-seg' }, [h('div', { class: 'rev-seg-air', text: x.name || 'Hotel' }), h('div', { class: 'rev-seg-cities', text: [x.location, x.room, x.board].filter(Boolean).join('  ·  ') }), (x.checkin_date || x.checkout_date) ? h('div', { class: 'rev-seg-date', text: [x.checkin_date ? fmtDate(x.checkin_date) : '', x.checkout_date ? fmtDate(x.checkout_date) : ''].filter(Boolean).join(' – ') }) : null]); });
    sec('Transfers', d.transport, function (x) { return h('div', { class: 'rev-seg' }, [h('div', { class: 'rev-seg-air', text: x.type || 'Transfer' }), h('div', { class: 'rev-seg-cities', text: [x.from, x.to].filter(Boolean).join(' → ') }), x.date ? h('div', { class: 'rev-seg-date', text: fmtDate(x.date) }) : null]); });
    sec('Dining & experiences', d.entertainment, function (x) { return h('div', { class: 'rev-seg' }, [h('div', { class: 'rev-seg-air', text: x.name || 'Experience' }), h('div', { class: 'rev-seg-cities', text: [x.category, x.location].filter(Boolean).join('  ·  ') }), x.date ? h('div', { class: 'rev-seg-date', text: fmtDate(x.date) }) : null]); });
    sec('Cruises', d.cruises, function (x) { return h('div', { class: 'rev-seg' }, [h('div', { class: 'rev-seg-air', text: [x.line, x.ship].filter(Boolean).join('  ·  ') || 'Cruise' }), h('div', { class: 'rev-seg-cities', text: [x.embark_port, x.disembark_port].filter(Boolean).join(' → ') }), x.embark_date ? h('div', { class: 'rev-seg-date', text: fmtDate(x.embark_date) }) : null]); });
  }
  function reviewDoc(d) {
    var c = dcfg(), kind = state.docKind, total = d.line_items.reduce(function (s, i) { return s + i.amount; }, 0), cur = d.currency, p = d.customer;
    var wrap = h('div', { class: 'inv-review' });
    wrap.appendChild(h('div', { class: 'rev-actions' }, [
      h('button', { class: 'btn btn-ghost', style: 'width:auto', onclick: function () { state.docView = 'form'; renderTab(); }, text: '← Back to edit' }),
      h('div', { id: 'rev-msg', class: 'msg', style: 'display:none' }),
      h('button', { class: 'btn btn-primary', style: 'width:auto; padding:12px 26px', onclick: function (e) { sendDoc(e.target); }, text: c.send })
    ]));
    var docEl = h('div', { class: 'rev-doc' });
    var metaExtra = kind === 'quote' ? (d.valid_until ? h('div', { class: 'rev-inv-date', text: 'Valid until ' + fmtDate(d.valid_until) }) : null) : (d.due_date ? h('div', { class: 'rev-inv-date', text: 'Balance due ' + fmtDate(d.due_date) }) : null);
    docEl.appendChild(h('div', { class: 'rev-head' }, [
      agencyHead(),
      h('div', { class: 'rev-meta' }, [h('div', { class: 'rev-inv-label', text: c.head }), h('div', { class: 'rev-inv-date', text: 'Issued ' + fmtDate(new Date().toISOString()) }), metaExtra])
    ]));
    docEl.appendChild(h('div', { class: 'rev-cols' }, [
      h('div', null, [h('h4', { class: 'rev-h4', text: c.billLabel }), h('div', { class: 'rev-strong', text: [p.title, fullName(p)].filter(Boolean).join(' ') }), h('div', { class: 'rev-line', text: p.email || '' }), p.phone ? h('div', { class: 'rev-line', text: p.phone }) : null, p.account_number ? h('div', { class: 'rev-line', text: 'Account no. ' + p.account_number }) : null]),
      h('div', null, [h('h4', { class: 'rev-h4', text: 'Trip' }), d.title ? h('div', { class: 'rev-strong', text: d.title }) : null, d.destination ? h('div', { class: 'rev-line', text: d.destination }) : null, h('div', { class: 'rev-line', text: paxLabel(d) }), d.booking_reference ? h('div', { class: 'rev-line', text: 'Ref ' + d.booking_reference }) : null])
    ]));
    if (d.segments.length) {
      docEl.appendChild(h('div', { class: 'rev-routing' }, [h('h4', { class: 'rev-h4', text: 'Routing' }), h('div', { class: 'rev-segs' }, d.segments.map(function (s) {
        return h('div', { class: 'rev-seg' }, [h('div', { class: 'rev-seg-route' }, [h('b', { text: s.from.code }), h('span', { class: 'rev-seg-arrow', text: '→' }), h('b', { text: s.to.code })]), h('div', { class: 'rev-seg-cities', text: s.from.city + ' to ' + s.to.city }), (s.airline || s.cabin) ? h('div', { class: 'rev-seg-air', text: [s.airline, s.cabin].filter(Boolean).join(' · ') }) : null, s.depart_date ? h('div', { class: 'rev-seg-date', text: fmtDate(s.depart_date) + (s.return_date ? ' – ' + fmtDate(s.return_date) : '') }) : null]);
      }))]));
    }
    if (kind === 'quote') pkgReviewInto(docEl, d);
    var rows = d.line_items.map(function (it) { return h('div', { class: 'rev-item' }, [h('div', { class: 'rev-item-label' }, [h('div', { class: 'rev-strong', text: it.label }), it.detail ? h('div', { class: 'rev-item-detail', text: it.detail }) : null]), h('div', { class: 'rev-item-amt', text: money(it.amount, cur) })]); });
    docEl.appendChild(h('div', { class: 'rev-items' }, [h('div', { class: 'rev-item rev-item-head' }, [h('div', { text: 'Description' }), h('div', { text: 'Amount' })])].concat(rows)));
    var totalsEls;
    if (kind === 'invoice' && d.deposit_paid) { totalsEls = [tline('Subtotal', money(total, cur)), tline('Deposit paid', '− ' + money(d.deposit_paid, cur)), tline('Balance due', money(total - d.deposit_paid, cur), true)]; }
    else { totalsEls = [tline('Subtotal', money(total, cur)), tline(kind === 'quote' ? 'Quote total' : 'Total', money(total, cur), true)]; }
    docEl.appendChild(h('div', { class: 'rev-totals' }, totalsEls));
    if (d.comparable_total && d.comparable_total > total) {
      docEl.appendChild(h('div', { class: 'rev-savings' }, [h('div', { class: 'rev-savings-k', text: 'Comparable price booked elsewhere ' + money(d.comparable_total, cur) }), h('div', { class: 'rev-savings-big' }, [h('span', { text: 'You saved ' }), h('b', { text: money(d.comparable_total - total, cur) })])]));
    }
    if (d.notes) docEl.appendChild(h('div', { class: 'rev-notes' }, [h('h4', { class: 'rev-h4', text: 'Notes' }), h('p', { text: d.notes })]));
    if (kind === 'invoice') {
      var defs = payMethodDefs();
      var chosen = defs.filter(function (m) { return !d.payment_methods || d.payment_methods.indexOf(m[0]) > -1; });
      if (chosen.length) docEl.appendChild(h('div', { class: 'rev-notes' }, [h('h4', { class: 'rev-h4', text: 'Payment options the customer will see' })].concat(chosen.map(function (m) { return h('p', null, [h('b', { text: m[1] + ':  ' }), '' + m[2]]); }))));
    }
    var setT = state.settings || {};
    var terms = kind === 'quote'
      ? (setT.quote_terms || ('This quote is an estimate' + (d.valid_until ? ', valid until ' + fmtDate(d.valid_until) : '') + '. Fares and availability are confirmed at the time of ticketing and may change until then.'))
      : (setT.invoice_terms || 'Fares and availability are confirmed at time of ticketing. Cancellation and change terms vary by fare and supplier; ask your agent for the rules that apply to this booking.');
    docEl.appendChild(h('p', { class: 'rev-terms', text: terms }));
    wrap.appendChild(docEl); return wrap;
  }
  async function sendDoc(btn) {
    var c = dcfg(), d = state.docDraft, msg = document.getElementById('rev-msg');
    if (!d || !d.customer) { state.docView = 'form'; renderTab(); return; }
    var total = d.line_items.reduce(function (s, i) { return s + i.amount; }, 0);
    var payload = { customer_email: d.customer.email, account_number: d.customer.account_number || null, user_id: d.customer.id, title: d.title || null, destination: d.destination || null, trip_type: d.trip_type || null, segments: d.segments, passengers: d.passengers, pax_adults: d.pax_adults, pax_children: d.pax_children, pax_infants: d.pax_infants, booking_reference: d.booking_reference || null, line_items: d.line_items, currency: d.currency, total_charged: total, comparable_total: d.comparable_total, notes: d.notes || null };
    var editing = (state.docKind === 'quote' || state.docKind === 'invoice') && d.editing_id;
    if (state.docKind === 'invoice') {
      var dep = Math.min(Math.max(d.deposit_paid || 0, 0), total);
      payload.deposit_paid = dep || null; payload.due_date = d.due_date || null; payload.payment_methods = (d.payment_methods && d.payment_methods.length) ? d.payment_methods : null;
      /* on an EDIT, recorded payments stay as they are — only fresh invoices start at the deposit */
      if (!editing) { payload.amount_paid = dep; if (total > 0 && dep >= total - 0.001) payload.paid_at = new Date().toISOString(); }
    }
    else { payload.valid_until = d.valid_until || null; payload.options = (d.options && d.options.length) ? d.options : null; if (d.request_id) payload.request_id = d.request_id; payload.hotels = d.hotels || []; payload.transport = d.transport || []; payload.entertainment = d.entertainment || []; payload.cruises = d.cruises || []; }
    btn.disabled = true; btn.textContent = editing ? 'Resending…' : 'Sending…';
    var r;
    if (editing) { if (state.docKind === 'quote') payload.status = 'sent'; r = await sb.from(c.table).update(payload).eq('id', d.editing_id).select().maybeSingle(); }
    else { r = await sb.from(c.table).insert(payload).select().maybeSingle(); }
    btn.disabled = false; btn.textContent = c.send;
    if (r.error) { showInvMsg(msg, r.error.message || 'Could not send.', 'err'); return; }
    if (state.docKind === 'quote' && d.request_id) { sb.from('quote_requests').update({ status: 'quoted' }).eq('id', d.request_id).then(function () { loadReqBarCount(); }).catch(function (e) { console.warn('mark request quoted failed', e); }); }
    if (state.docKind === 'invoice' && r.data && d.net_cost != null) { sb.from('invoice_finance').upsert({ invoice_id: r.data.id, net_cost: d.net_cost }).then(function () {}).catch(function (e) { console.warn('save invoice finance failed', e); }); }
    if (state.docKind === 'invoice' && d.source_quote_id) { sb.from('quotes').update({ status: 'accepted' }).eq('id', d.source_quote_id).then(function () {}).catch(function (e) { console.warn('mark quote accepted failed', e); }); }
    var num = (r.data && r.data[c.numKey]) ? r.data[c.numKey] : (d.editing_number || '');
    state.docFlash = { kind: 'ok', text: editing ? (c.flashWord + ' ' + num + ' updated & resent to ' + fullName(d.customer) + '.') : (c.flashWord + ' ' + num + ' sent to ' + fullName(d.customer) + '. It is now in their account.') };
    clearCurrentDraft();
    state.docCustomer = null; state.docDraft = null; state.docView = 'form'; renderTab();
  }

  /* ---------- itineraries ---------- */
  var TRANSPORT_TYPES = ['Chauffeur', 'Private transfer', 'Car service', 'Car rental', 'Train', 'Yacht / boat', 'Helicopter', 'Other'];
  var BOARD_TYPES = ['Not specified', 'Room only', 'Bed & breakfast', 'Half board', 'Full board', 'All-inclusive'];
  var DINING_CATEGORIES = ['Restaurant', 'Fine dining', 'Bar', 'Lounge', 'Café', 'Other'];
  var ENT_CATEGORIES = ['Show / theatre', 'Tour', 'Experience', 'Spa', 'Event', 'Other'];
  function fmtTime(t) { if (!t) return ''; var m = ('' + t).match(/^(\d{1,2}):(\d{2})/); if (!m) return t; var hh = +m[1], ap = hh >= 12 ? 'pm' : 'am', h12 = hh % 12 || 12; return h12 + ':' + m[2] + ' ' + ap; }
  function itinTimeRange(d1, t1, d2, t2) {
    var a = d1 ? fmtDate(d1) + (t1 ? ', ' + fmtTime(t1) : '') : '';
    var b = d2 ? fmtDate(d2) + (t2 ? ', ' + fmtTime(t2) : '') : '';
    return [a, b].filter(Boolean).join(' → ');
  }
  function vcard(card, sel) { var el = card.querySelector(sel); return el ? el.value.trim() : ''; }
  function cinput(cls, value, ph, type) { return h('input', { class: 'inv-input ' + cls, type: type || 'text', value: value || '', placeholder: ph || '' }); }
  function clabel(label, cls, value, ph, type) { return h('label', { class: 'inv-field' }, [h('span', { text: label }), cinput(cls, value, ph, type)]); }
  function cdt(label, dcls, tcls, dval, tval) { return h('label', { class: 'inv-field' }, [h('span', { text: label }), h('div', { class: 'itin-dt' }, [cinput(dcls, dval, '', 'date'), cinput(tcls, tval, '', 'time')])]); }
  function itinRm() { return h('button', { type: 'button', class: 'seg-card-rm', title: 'Remove', onclick: function (e) { e.target.closest('.itin-card').remove(); }, text: '×' }); }
  /* ---- autocomplete (Photon geocoder: cities + POIs like hotels/venues/airports — graceful free-typing fallback) ---- */
  function acLocality(p) { var out = []; [p.city, p.state, p.country].forEach(function (v) { if (v && out.indexOf(v) < 0) out.push(v); }); return out.join(', '); }
  function acAddress(p) {
    var line1 = [p.housenumber, p.street].filter(Boolean).join(' ') || p.name || '';
    var rest = []; [p.district, p.city, p.state, p.postcode, p.country].forEach(function (v) { if (v && rest.indexOf(v) < 0) rest.push(v); });
    return [line1].concat(rest).filter(Boolean).join(', ');
  }
  function acNorm(s) { return (s || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }
  function acInput(cls, value, ph, opts) {
    opts = opts || {};
    var wrap = h('div', { class: 'ac-wrap' });
    var attrs = { class: 'inv-input ' + (cls || ''), type: 'text', autocomplete: 'off', value: value || '', placeholder: ph || '' };
    if (opts.id) attrs.id = opts.id;
    var input = h('input', attrs);
    var menu = h('div', { class: 'ac-menu', hidden: true });
    wrap.appendChild(input); wrap.appendChild(menu);
    var timer = null, items = [], active = -1, reqSeq = 0;
    var twoLine = opts.mode === 'poi' || opts.mode === 'address';
    function close() { menu.hidden = true; menu.textContent = ''; active = -1; }
    function seedQ() {
      var card = input.closest('.itin-card'); if (!card) return '';
      var nm = opts.nameCls ? ((card.querySelector('.' + opts.nameCls) || {}).value || '') : '';
      var ct = opts.cityCls ? ((card.querySelector('.' + opts.cityCls) || {}).value || '') : '';
      return [nm, ct].map(function (s) { return (s || '').trim(); }).filter(Boolean).join(' ');
    }
    function pick(it) {
      input.value = opts.mode === 'poi' ? (it.name || it.label) : it.label;
      input._picked = true;
      input.dispatchEvent(new Event('change'));
      if (opts.mode === 'address' && opts.cityCls) { var card = input.closest('.itin-card'); if (card) { var ce = card.querySelector('.' + opts.cityCls); if (ce && !ce.value.trim()) { var loc = acLocality({ city: it.props.city, state: it.props.state, country: it.props.country }); if (loc) ce.value = loc; } } }
      if (opts.mode === 'city') { var cc = input.closest('.itin-card'); if (cc && it.coords) { cc.setAttribute('data-lon', it.coords[0]); cc.setAttribute('data-lat', it.coords[1]); if (it.props && it.props.country) cc.setAttribute('data-country', it.props.country); } }
      if (opts.onPick) { try { opts.onPick(it.props, input); } catch (e) {} }
      close();
    }
    function paint() {
      menu.textContent = '';
      items.forEach(function (it, i) {
        var row = h('div', { class: 'ac-item' + (i === active ? ' is-active' : '') });
        if (twoLine && it.sub) { row.appendChild(h('div', { class: 'ac-name', text: it.name })); row.appendChild(h('div', { class: 'ac-sub', text: it.sub })); }
        else row.textContent = it.label;
        row.addEventListener('mousedown', function (e) { e.preventDefault(); pick(it); });
        menu.appendChild(row);
      });
      menu.hidden = !items.length;
    }
    function fmt(features, bias) {
      var arr = features.slice(), bc = bias ? bias.country : null;
      if (bias && bias.lat) {
        var blat = parseFloat(bias.lat), blon = parseFloat(bias.lon), kx = Math.cos(blat * Math.PI / 180);
        arr.forEach(function (f) { var c = f.geometry && f.geometry.coordinates; if (c) { var dLat = c[1] - blat, dLon = (c[0] - blon) * kx; f._d = dLat * dLat + dLon * dLon; } else f._d = 1e9; });
        arr.sort(function (a, b) { return a._d - b._d; });
      }
      var seen = {}, out = [];
      arr.forEach(function (f) {
        var p = f.properties || {}, t = p.osm_value || p.type || '';
        if (!p.name) return;
        if (bc && p.country && p.country !== bc) return;
        if (opts.mode === 'city') {
          if (['city', 'town', 'village', 'municipality', 'hamlet'].indexOf(t) < 0) return;
          var parts = [p.name]; if (p.state && p.state !== p.name) parts.push(p.state); if (p.country) parts.push(p.country);
          var lab = parts.filter(Boolean).join(', '); if (lab && !seen[lab]) { seen[lab] = 1; out.push({ label: lab, name: p.name, props: p, coords: f.geometry && f.geometry.coordinates }); }
        } else if (opts.mode === 'address') {
          if (['country', 'state', 'county', 'continent'].indexOf(t) > -1) return;
          var a = acAddress(p); if (a && !seen[a]) { seen[a] = 1; out.push({ label: a, name: p.name, sub: a, props: p }); }
        } else {
          if (['country', 'state', 'county', 'continent'].indexOf(t) > -1) return;
          var loc = acLocality({ city: p.city, state: p.state, country: p.country });
          var label = p.name + (loc ? ' — ' + loc : ''); if (!seen[label]) { seen[label] = 1; out.push({ label: label, name: p.name, sub: loc, props: p }); }
        }
      });
      return out.slice(0, 7);
    }
    function getBias() {
      if (!opts.cityCls) return Promise.resolve(null);
      var card = input.closest('.itin-card'); if (!card) return Promise.resolve(null);
      var lat = card.getAttribute('data-lat'), lon = card.getAttribute('data-lon');
      if (lat && lon) return Promise.resolve({ lat: lat, lon: lon, country: card.getAttribute('data-country') });
      var ct = ((card.querySelector('.' + opts.cityCls) || {}).value || '').trim();
      if (!ct) return Promise.resolve(null);
      return fetch('https://photon.komoot.io/api/?q=' + encodeURIComponent(ct) + '&limit=1&lang=en')
        .then(function (r) { return r.json(); })
        .then(function (j) { var f = (j.features || [])[0]; if (f && f.geometry && f.geometry.coordinates) { var c = f.geometry.coordinates, pr = f.properties || {}; card.setAttribute('data-lon', c[0]); card.setAttribute('data-lat', c[1]); if (pr.country) card.setAttribute('data-country', pr.country); return { lat: c[1], lon: c[0], country: pr.country }; } return null; })
        .catch(function () { return null; });
    }
    function search(q) {
      var myReq = ++reqSeq;
      var bp = (opts.mode === 'poi' || opts.mode === 'address') ? getBias() : Promise.resolve(null);
      bp.then(function (bias) {
        if (myReq !== reqSeq) return; /* a newer keystroke superseded this request */
        var url = 'https://photon.komoot.io/api/?q=' + encodeURIComponent(q) + '&limit=' + (bias ? 30 : 10) + '&lang=en' + (bias ? ('&lat=' + bias.lat + '&lon=' + bias.lon + '&location_bias_scale=0.9') : '');
        fetch(url).then(function (r) { return r.json(); }).then(function (j) { if (myReq !== reqSeq) return; items = fmt(j.features || [], bias); active = -1; paint(); }).catch(function () { if (myReq === reqSeq) close(); });
      });
    }
    input.addEventListener('input', function () {
      input._picked = false;
      if (opts.mode === 'city') { var cc = input.closest('.itin-card'); if (cc) { cc.removeAttribute('data-lat'); cc.removeAttribute('data-lon'); cc.removeAttribute('data-country'); } }
      var q = input.value.trim(); clearTimeout(timer);
      if (q.length < 2) { close(); return; }
      timer = setTimeout(function () { search(q); }, 260);
    });
    if (opts.mode === 'address') {
      input.addEventListener('focus', function () { if (input._picked || input.value.trim()) return; var s = seedQ(); if (s) search(s); });
    }
    input.addEventListener('keydown', function (e) {
      if (menu.hidden) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(active + 1, items.length - 1); paint(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(active - 1, 0); paint(); }
      else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(items[active]); }
      else if (e.key === 'Escape') { close(); }
    });
    input.addEventListener('blur', function () { setTimeout(close, 150); });
    return wrap;
  }
  function cityInput(cls, value, ph, id) { return acInput(cls, value, ph, { mode: 'city', id: id }); }
  function cityField(label, cls, value, ph, id) { return h('label', { class: 'inv-field' }, [h('span', { text: label }), cityInput(cls, value, ph, id)]); }
  function poiField(label, cls, value, ph, onPick, cityCls) { return h('label', { class: 'inv-field' }, [h('span', { text: label }), acInput(cls, value, ph, { mode: 'poi', onPick: onPick, cityCls: cityCls })]); }
  function addrField(label, cls, value, ph, nameCls, cityCls) { return h('label', { class: 'inv-field' }, [h('span', { text: label }), acInput(cls, value, ph, { mode: 'address', nameCls: nameCls, cityCls: cityCls })]); }
  /* when a hotel/venue is picked, auto-fill empty sibling City (and hotel Address) fields */
  function fillFromPoi(props, input, cityCls, addrCls) {
    var card = input.closest('.itin-card'); if (!card) return;
    if (cityCls) { var cityEl = card.querySelector('.' + cityCls); if (cityEl && !cityEl.value.trim()) { var loc = acLocality({ city: props.city, state: props.state, country: props.country }); if (loc) cityEl.value = loc; } }
    if (addrCls) { var addrEl = card.querySelector('.' + addrCls); if (addrEl && !addrEl.value.trim() && !addrEl._picked) { var addr = acAddress(props); if (addr) addrEl.value = addr; } }
  }
  /* auto-resolve a single address from name+city; leave empty when multiple locations so the user picks via the Address field */
  function resolveAddress(card, nameCls, cityCls, addrCls) {
    var addrEl = card.querySelector('.' + addrCls); if (!addrEl || addrEl._picked || addrEl.value.trim()) return;
    var nm = ((card.querySelector('.' + nameCls) || {}).value || '').trim();
    var ct = ((card.querySelector('.' + cityCls) || {}).value || '').trim();
    if (nm.length < 3 || !ct) return;
    var nn = acNorm(nm);
    fetch('https://photon.komoot.io/api/?q=' + encodeURIComponent(nm + ' ' + ct) + '&limit=8&lang=en')
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (addrEl.value.trim() || addrEl._picked) return;
        var seen = {}, addrs = [];
        (j.features || []).forEach(function (f) { var p = f.properties || {}; if (!p.name) return; var pn = acNorm(p.name); if (pn.indexOf(nn) < 0 && nn.indexOf(pn) < 0) return; var a = acAddress(p); if (a && !seen[a]) { seen[a] = 1; addrs.push(a); } });
        if (addrs.length === 1) addrEl.value = addrs[0];
      })
      .catch(function () {});
  }
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.classList) return;
    var card = t.closest && t.closest('.itin-card'); if (!card) return;
    if (t.classList.contains('h-name') || t.classList.contains('h-location')) resolveAddress(card, 'h-name', 'h-location', 'h-address');
    else if (t.classList.contains('e-name') || t.classList.contains('e-location')) resolveAddress(card, 'e-name', 'e-location', 'e-address');
  });
  /* ---- themed calendar + time picker (Flatpickr) on every date/time input in a container ---- */
  function initDatePickers(root) {
    if (!window.flatpickr || !root) return;
    Array.prototype.forEach.call(root.querySelectorAll('input[type=date]'), function (el) {
      if (el._flatpickr) return;
      try { window.flatpickr(el, { dateFormat: 'Y-m-d', altInput: true, altFormat: 'M j, Y', allowInput: true, disableMobile: true }); } catch (e) {}
    });
    Array.prototype.forEach.call(root.querySelectorAll('input[type=time]'), function (el) {
      if (el._flatpickr) return;
      try { window.flatpickr(el, { enableTime: true, noCalendar: true, dateFormat: 'H:i', altInput: true, altFormat: 'h:i K', allowInput: true, disableMobile: true }); } catch (e) {}
    });
  }
  /* photo picked at review time rides along invisibly so a back-to-edit round trip keeps it */
  function cardImgKeep(x) { return h('input', { type: 'hidden', class: 'card-img-url', value: (x && x.image_url) || '' }); }
  /* booking confirmation image (QR / barcode / email screenshot) the customer shows at the venue */
  function setConf(el, m, k) { if (el) { el.textContent = m; el.className = 'conf-status' + (k ? ' cs-' + k : ''); } }
  async function uploadConfImage(file, statusEl, hidden, thumb, btnLabel) {
    if (!/^image\//.test(file.type)) { setConf(statusEl, 'Please choose an image file.', 'err'); return; }
    if (file.size > 6 * 1024 * 1024) { setConf(statusEl, 'Image is too large (max 6 MB).', 'err'); return; }
    setConf(statusEl, 'Uploading…', '');
    var ext = ((file.name || '').split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    var id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now() + '-' + Math.round(Math.random() * 1e9));
    var path = 'conf/' + id + '.' + ext;
    var up;
    try { up = await sb.storage.from('itinerary-media').upload(path, file, { upsert: true, contentType: file.type }); }
    catch (e) { up = { error: e }; }
    if (up.error) { setConf(statusEl, up.error.message || 'Upload failed.', 'err'); return; }
    var pub = sb.storage.from('itinerary-media').getPublicUrl(path);
    var url = pub && pub.data && pub.data.publicUrl;
    if (!url) { setConf(statusEl, 'Upload failed.', 'err'); return; }
    hidden.value = url;
    thumb.style.backgroundImage = 'url("' + url.replace(/["\\\r\n]/g, '') + '")'; thumb.classList.add('has-img');
    if (btnLabel) btnLabel.textContent = 'Replace';
    setConf(statusEl, 'Uploaded ✓', 'ok');
  }
  function confField(x) {
    var url = (x && x.confirmation_image) || '';
    var hidden = h('input', { type: 'hidden', class: 'e-conf-img', value: url });
    var thumb = h('div', { class: 'conf-thumb' + (url ? ' has-img' : '') });
    if (url) thumb.style.backgroundImage = 'url("' + url.replace(/["\\\r\n]/g, '') + '")';
    var status = h('span', { class: 'conf-status' });
    var file = h('input', { type: 'file', accept: 'image/*', class: 'conf-file', style: 'display:none' });
    var lbl = h('span', { text: url ? 'Replace' : 'Upload' });
    file.addEventListener('change', function () { if (file.files && file.files[0]) uploadConfImage(file.files[0], status, hidden, thumb, lbl); });
    var uploadBtn = h('label', { class: 'conf-btn' }, [lbl, file]);
    var removeBtn = h('button', { type: 'button', class: 'conf-btn conf-rm', onclick: function () { hidden.value = ''; thumb.style.backgroundImage = ''; thumb.classList.remove('has-img'); lbl.textContent = 'Upload'; setConf(status, '', ''); }, text: 'Remove' });
    return h('div', { class: 'inv-field conf-field' }, [
      h('span', { text: 'Confirmation / ticket (optional)' }),
      h('p', { class: 'conf-hint', text: 'Upload the QR code, barcode or booking-confirmation image the customer shows at the venue. It appears on their itinerary and the PDF.' }),
      h('div', { class: 'conf-row' }, [thumb, h('div', { class: 'conf-actions' }, [uploadBtn, removeBtn, status])]),
      hidden
    ]);
  }
  function hotelCard(x) {
    return h('div', { class: 'itin-card', 'data-itin': 'hotel' }, [itinRm(), cardImgKeep(x),
      h('div', { class: 'inv-row2' }, [poiField('Hotel', 'h-name', x && x.name, 'e.g. Burj Al Arab', function (p, inp) { fillFromPoi(p, inp, 'h-location', 'h-address'); }, 'h-location'), cityField('City', 'h-location', x && x.location, 'Start typing a city…')]),
      addrField('Address', 'h-address', x && x.address, 'Auto-fills, or click to pick a location', 'h-name', 'h-location'),
      h('div', { class: 'inv-row2' }, [cdt('Check-in', 'h-cin-date', 'h-cin-time', x && x.checkin_date, x ? x.checkin_time : '15:00'), cdt('Check-out', 'h-cout-date', 'h-cout-time', x && x.checkout_date, x ? x.checkout_time : '11:00')]),
      bookedCtx() ? h('div', { class: 'inv-row2' }, [clabel('Room / suite', 'h-room', x && x.room, 'e.g. Royal Suite'), clabel('Confirmation no.', 'h-conf', x && x.confirmation, 'Optional')]) : clabel('Room / suite', 'h-room', x && x.room, 'e.g. Royal Suite'),
      h('div', { class: 'inv-row3' }, [
        h('label', { class: 'inv-field' }, [h('span', { text: 'Meals included' }), h('div', { class: 'h-board-wrap' }, [styledSelect(null, (x && x.board) || 'Not specified', BOARD_TYPES, null)])]),
        clabel('Rooms', 'h-rooms', x && x.rooms, 'e.g. 2 × Deluxe · 1 × Suite'),
        clabel('Hotel phone', 'h-phone', x && x.phone, 'Optional')
      ]),
      clabel('Notes', 'h-notes', x && x.notes, 'Optional'),
      bookedCtx() ? confField(x) : null
    ]);
  }
  function transportCard(x) {
    return h('div', { class: 'itin-card', 'data-itin': 'transport' }, [itinRm(), cardImgKeep(x),
      h('div', { class: 'inv-row2' }, [h('label', { class: 'inv-field' }, [h('span', { text: 'Type' }), styledSelect(null, (x && x.type) || 'Chauffeur', TRANSPORT_TYPES, null)]), cdt('Date & time', 't-date', 't-time', x && x.date, x && x.time)]),
      h('div', { class: 'inv-row2' }, [poiField('From / pickup', 't-from', x && x.from, 'e.g. DXB Airport', null), poiField('To / dropoff', 't-to', x && x.to, 'e.g. Burj Al Arab', null)]),
      bookedCtx() ? h('p', { class: 'itin-opthint', text: 'Driver details — optional. Anything left blank is hidden from the customer.' }) : null,
      bookedCtx() ? h('div', { class: 'inv-row3' }, [clabel('Driver name', 't-driver', x && x.driver, 'Optional'), clabel('Car', 't-car', x && x.car, 'e.g. Mercedes S-Class'), clabel('License plate', 't-plate', x && x.plate, 'Optional')]) : clabel('Car / vehicle', 't-car', x && x.car, 'e.g. Mercedes S-Class'),
      bookedCtx() ? h('div', { class: 'inv-row3' }, [clabel('Provider / company', 't-company', x && x.company, 'e.g. Blacklane'), clabel('Provider phone', 't-phone', x && x.phone, 'Optional'), clabel('Confirmation no.', 't-conf', x && x.confirmation, 'Optional')]) : h('div', { class: 'inv-row2' }, [clabel('Provider / company', 't-company', x && x.company, 'e.g. Blacklane'), clabel('Provider phone', 't-phone', x && x.phone, 'Optional')]),
      clabel('Notes', 't-notes', x && x.notes, 'Optional'),
      bookedCtx() ? confField(x) : null
    ]);
  }
  function diningCard(x) {
    return h('div', { class: 'itin-card', 'data-itin': 'dining' }, [itinRm(), cardImgKeep(x),
      h('div', { class: 'inv-row2' }, [poiField('Name', 'e-name', x && x.name, 'e.g. Nobu Dubai', function (p, inp) { fillFromPoi(p, inp, 'e-location', 'e-address'); }, 'e-location'), h('label', { class: 'inv-field' }, [h('span', { text: 'Type' }), styledSelect(null, (x && x.category) || 'Restaurant', DINING_CATEGORIES, null)])]),
      h('div', { class: 'inv-row2' }, [cityField('City', 'e-location', x && x.location, 'Start typing a city…'), cdt('Date & time', 'e-date', 'e-time', x && x.date, x && x.time)]),
      addrField('Address', 'e-address', x && x.address, 'Auto-fills, or click to pick a location', 'e-name', 'e-location'),
      bookedCtx() ? h('div', { class: 'inv-row3' }, [clabel('Confirmation no.', 'e-conf', x && x.confirmation, 'Optional'), clabel('Party size', 'e-party', x && x.party, 'e.g. 15'), clabel('Venue phone', 'e-phone', x && x.phone, 'Optional')]) : h('div', { class: 'inv-row2' }, [clabel('Party size', 'e-party', x && x.party, 'e.g. 15'), clabel('Venue phone', 'e-phone', x && x.phone, 'Optional')]),
      clabel('Notes', 'e-notes', x && x.notes, 'Optional'),
      bookedCtx() ? confField(x) : null
    ]);
  }
  function entCard(x) {
    return h('div', { class: 'itin-card', 'data-itin': 'ent' }, [itinRm(), cardImgKeep(x),
      h('div', { class: 'inv-row2' }, [poiField('Name', 'e-name', x && x.name, 'e.g. Desert safari', function (p, inp) { fillFromPoi(p, inp, 'e-location', 'e-address'); }, 'e-location'), h('label', { class: 'inv-field' }, [h('span', { text: 'Category' }), styledSelect(null, (x && x.category) || 'Experience', ENT_CATEGORIES, null)])]),
      h('div', { class: 'inv-row2' }, [cityField('City', 'e-location', x && x.location, 'Start typing a city…'), cdt('Date & time', 'e-date', 'e-time', x && x.date, x && x.time)]),
      addrField('Address', 'e-address', x && x.address, 'Auto-fills, or click to pick a location', 'e-name', 'e-location'),
      bookedCtx() ? h('div', { class: 'inv-row3' }, [clabel('Confirmation no.', 'e-conf', x && x.confirmation, 'Optional'), clabel('Party size', 'e-party', x && x.party, 'e.g. 15'), clabel('Venue phone', 'e-phone', x && x.phone, 'Optional')]) : h('div', { class: 'inv-row2' }, [clabel('Party size', 'e-party', x && x.party, 'e.g. 15'), clabel('Venue phone', 'e-phone', x && x.phone, 'Optional')]),
      clabel('Notes', 'e-notes', x && x.notes, 'Optional'),
      bookedCtx() ? confField(x) : null
    ]);
  }
  function cruiseCard(x) {
    return h('div', { class: 'itin-card', 'data-itin': 'cruise' }, [itinRm(), cardImgKeep(x),
      h('div', { class: 'inv-row2' }, [clabel('Cruise line', 'c-line', x && x.line, 'e.g. Explora Journeys'), clabel('Ship', 'c-ship', x && x.ship, 'e.g. Explora I')]),
      bookedCtx() ? h('div', { class: 'inv-row2' }, [clabel('Suite / cabin category', 'c-cabin', x && x.cabin, 'e.g. Ocean Terrace Suite'), clabel('Deck and cabin no.', 'c-deck', x && x.deck, 'e.g. Deck 8, 8014')]) : clabel('Suite / cabin category', 'c-cabin', x && x.cabin, 'e.g. Ocean Terrace Suite'),
      h('div', { class: 'inv-row2' }, [h('label', { class: 'inv-field' }, [h('span', { text: 'Embarkation port' }), cityInput('c-eport', x && x.embark_port, 'e.g. Civitavecchia (Rome)')]), cdt('Embarks', 'c-edate', 'c-etime', x && x.embark_date, x && x.embark_time)]),
      h('div', { class: 'inv-row2' }, [h('label', { class: 'inv-field' }, [h('span', { text: 'Disembarkation port' }), cityInput('c-dport', x && x.disembark_port, 'e.g. Piraeus (Athens)')]), cdt('Disembarks', 'c-ddate', 'c-dtime', x && x.disembark_date, x && x.disembark_time)]),
      bookedCtx() ? h('div', { class: 'inv-row2' }, [clabel('Booking no.', 'c-conf', x && x.confirmation, 'Optional'), clabel('Cruise line phone', 'c-phone', x && x.phone, 'Optional')]) : clabel('Cruise line phone', 'c-phone', x && x.phone, 'Optional'),
      clabel('Notes', 'c-notes', x && x.notes, 'Ports of call, dress codes, included excursions'),
      bookedCtx() ? confField(x) : null
    ]);
  }
  function dayCard(x) {
    return h('div', { class: 'itin-card', 'data-itin': 'day' }, [itinRm(),
      h('div', { class: 'inv-row2' }, [clabel('Date', 'd-date', x && x.date, '', 'date'), clabel('Headline', 'd-title', x && x.title, 'e.g. Day at leisure in Rome')]),
      h('label', { class: 'inv-field' }, [h('span', { text: 'What to know' }), h('textarea', { class: 'inv-input inv-textarea d-body', rows: '3', placeholder: 'Suggestions, timings, dress codes, anything helpful for that day.', value: (x && x.body) || '' })])
    ]);
  }
  function uploadTripDoc(file, statusEl, hidden, linkEl, btnLabel) {
    var okType = /^image\//.test(file.type) || file.type === 'application/pdf';
    if (!okType) { setConf(statusEl, 'PDF or image files only.', 'err'); return; }
    if (file.size > 15 * 1024 * 1024) { setConf(statusEl, 'File is too large (max 15 MB).', 'err'); return; }
    setConf(statusEl, 'Uploading\u2026', '');
    var ext = ((file.name || '').split('.').pop() || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '') || 'pdf';
    var id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now() + '-' + Math.round(Math.random() * 1e9));
    var path = 'docs/' + id + '.' + ext;
    sb.storage.from('itinerary-media').upload(path, file, { upsert: true, contentType: file.type }).then(function (up) {
      if (up.error) { setConf(statusEl, up.error.message || 'Upload failed.', 'err'); return; }
      var pub = sb.storage.from('itinerary-media').getPublicUrl(path);
      var url = pub && pub.data && pub.data.publicUrl;
      if (!url) { setConf(statusEl, 'Upload failed.', 'err'); return; }
      hidden.value = url;
      if (linkEl) { linkEl.href = url; linkEl.textContent = 'Open'; }
      var card = hidden.closest('.itin-card'); var nameInp = card && card.querySelector('.doc-name');
      if (nameInp && !nameInp.value.trim()) nameInp.value = (file.name || '').replace(/\.[^.]+$/, '');
      if (btnLabel) btnLabel.textContent = 'Replace file';
      setConf(statusEl, 'Uploaded \u2713', 'ok');
    }).catch(function (e) { setConf(statusEl, (e && e.message) || 'Upload failed.', 'err'); });
  }
  function docCard(x) {
    var hidden = h('input', { type: 'hidden', class: 'doc-url', value: (x && x.url) || '' });
    var status = h('span', { class: 'conf-status' });
    var file = h('input', { type: 'file', accept: 'application/pdf,image/*', class: 'conf-file', style: 'display:none' });
    var lbl = h('span', { text: (x && x.url) ? 'Replace file' : 'Choose file' });
    var link = h('a', { class: 'doc-open', href: (x && x.url) || '#', target: '_blank', rel: 'noopener', text: (x && x.url) ? 'Open' : '' });
    file.addEventListener('change', function () { if (file.files && file.files[0]) uploadTripDoc(file.files[0], status, hidden, link, lbl); });
    return h('div', { class: 'itin-card', 'data-itin': 'doc' }, [itinRm(),
      h('div', { class: 'inv-row2' }, [
        clabel('Document name', 'doc-name', x && x.name, 'e.g. Travel insurance certificate'),
        h('div', { class: 'inv-field' }, [h('span', { text: 'File (PDF or image)' }), h('div', { class: 'conf-row' }, [h('label', { class: 'conf-btn' }, [lbl, file]), link, status])])
      ]),
      hidden
    ]);
  }
  function readCards(containerId, type) {
    var arr = [];
    Array.prototype.forEach.call(document.querySelectorAll('#' + containerId + ' .itin-card'), function (c) {
      var img = ((c.querySelector('.card-img-url') || {}).value || '').trim() || null;
      var conf = ((c.querySelector('.e-conf-img') || {}).value || '').trim() || null;
      if (type === 'hotel') { var n = vcard(c, '.h-name'); if (!n) return; var board = ((c.querySelector('.h-board-wrap .ss input[type=hidden]') || {}).value || ''); arr.push({ name: n, location: vcard(c, '.h-location'), address: vcard(c, '.h-address'), checkin_date: vcard(c, '.h-cin-date') || null, checkin_time: vcard(c, '.h-cin-time') || null, checkout_date: vcard(c, '.h-cout-date') || null, checkout_time: vcard(c, '.h-cout-time') || null, room: vcard(c, '.h-room'), confirmation: vcard(c, '.h-conf'), board: (board && board !== 'Not specified') ? board : null, rooms: vcard(c, '.h-rooms'), phone: vcard(c, '.h-phone'), notes: vcard(c, '.h-notes'), image_url: img, confirmation_image: conf }); }
      else if (type === 'transport') { var hasAny = vcard(c, '.t-from') || vcard(c, '.t-to') || vcard(c, '.t-date'); if (!hasAny) return; var tt = (c.querySelector('.ss input[type=hidden]') || {}).value || ''; arr.push({ type: tt, date: vcard(c, '.t-date') || null, time: vcard(c, '.t-time') || null, from: vcard(c, '.t-from'), to: vcard(c, '.t-to'), driver: vcard(c, '.t-driver'), car: vcard(c, '.t-car'), plate: vcard(c, '.t-plate'), company: vcard(c, '.t-company'), phone: vcard(c, '.t-phone'), confirmation: vcard(c, '.t-conf'), notes: vcard(c, '.t-notes'), image_url: img, confirmation_image: conf }); }
      else if (type === 'cruise') { var cl = vcard(c, '.c-line'), cs = vcard(c, '.c-ship'); if (!cl && !cs) return; arr.push({ line: cl, ship: cs, cabin: vcard(c, '.c-cabin'), deck: vcard(c, '.c-deck'), embark_port: vcard(c, '.c-eport'), embark_date: vcard(c, '.c-edate') || null, embark_time: vcard(c, '.c-etime') || null, disembark_port: vcard(c, '.c-dport'), disembark_date: vcard(c, '.c-ddate') || null, disembark_time: vcard(c, '.c-dtime') || null, confirmation: vcard(c, '.c-conf'), phone: vcard(c, '.c-phone'), notes: vcard(c, '.c-notes'), image_url: img, confirmation_image: conf }); }
      else if (type === 'day') { var dd = vcard(c, '.d-date'), dt2 = vcard(c, '.d-title'), db = vcard(c, '.d-body'); if (!dd && !dt2 && !db) return; arr.push({ date: dd || null, title: dt2, body: db }); }
      else if (type === 'doc') { var du = ((c.querySelector('.doc-url') || {}).value || '').trim(); if (!du) return; arr.push({ name: vcard(c, '.doc-name') || 'Document', url: du }); }
      else { var en = vcard(c, '.e-name'); if (!en) return; var cat = (c.querySelector('.ss input[type=hidden]') || {}).value || ''; arr.push({ name: en, category: cat, kind: type === 'dining' ? 'dining' : 'experience', date: vcard(c, '.e-date') || null, time: vcard(c, '.e-time') || null, location: vcard(c, '.e-location'), address: vcard(c, '.e-address'), confirmation: vcard(c, '.e-conf'), party: vcard(c, '.e-party'), phone: vcard(c, '.e-phone'), notes: vcard(c, '.e-notes'), image_url: img, confirmation_image: conf }); }
    });
    return arr;
  }
  function tabItineraries() { enterBuilder('itinerary'); return tabItin(); }
  function tabItin() {
    var wrap = h('div');
    if (state.itinView === 'review' && state.itinDraft) { wrap.appendChild(mainHead('Review itinerary', 'Check everything, then send it to the customer.')); wrap.appendChild(h('div', { class: 'main-body' }, [reviewItin(state.itinDraft)])); return wrap; }
    if (state.itinView === 'list') {
      wrap.appendChild(mainHead('Sent itineraries', 'View or edit any itinerary you’ve sent.'));
      var lb = h('div', { class: 'main-body' });
      lb.appendChild(h('button', { class: 'btn btn-ghost', style: 'width:auto; margin-bottom:14px', onclick: function () { state.itinView = 'form'; state.itinDraft = null; state.draftId = null; renderTab(); }, text: '← New itinerary' }));
      var isearch = h('input', { class: 'inv-input list-search', type: 'text', placeholder: 'Search itineraries by customer, number or destination…', autocomplete: 'off', value: state.itSearch || '' });
      isearch.addEventListener('input', function () { state.itSearch = isearch.value; renderItinList(); });
      lb.appendChild(isearch);
      lb.appendChild(h('div', { id: 'sentitin-list' }, [h('div', { class: 'dash-loading', text: 'Loading itineraries…' })]));
      wrap.appendChild(lb); setTimeout(loadSentItins, 0); return wrap;
    }
    var editing = !!(state.itinDraft && state.itinDraft.editing_id);
    wrap.appendChild(mainHead(editing ? 'Edit itinerary' : 'New itinerary', editing ? 'Update the trip — it replaces the version in their account.' : 'Build the trip — flights, hotels, transport and experiences. It appears in their account.'));
    var body = h('div', { class: 'main-body' });
    if (state.itinFlash) { body.appendChild(flashEl(state.itinFlash)); state.itinFlash = null; }
    body.appendChild(sentItinsBar());
    body.appendChild(draftsBar('itinerary'));
    body.appendChild(itinForm(state.itinDraft));
    wrap.appendChild(body); return wrap;
  }
  function sentItinsBar() {
    var bar = h('div', { class: 'sent-bar' }, [
      h('div', { class: 'sent-bar-main' }, [h('span', { class: 'sent-bar-label', text: 'Sent itineraries' }), h('span', { class: 'sent-bar-count', id: 'sentitin-count', text: '' })]),
      h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto', onclick: function () { state.itinView = 'list'; renderTab(); }, text: 'View all' })
    ]);
    setTimeout(loadSentItinCount, 0);
    return bar;
  }
  async function loadSentItinCount() {
    var el = document.getElementById('sentitin-count'); if (!el) return;
    var r = await sb.from('itineraries').select('id', { count: 'exact', head: true });
    el = document.getElementById('sentitin-count'); if (!el) return;
    el.textContent = (r.count != null ? r.count : 0);
  }
  async function loadSentItins() {
    if (!document.getElementById('sentitin-list')) return;
    var r = await sb.from('itineraries').select('*').order('created_at', { ascending: false }).limit(200);
    if (!document.getElementById('sentitin-list')) return;
    state.allItins = r.data || [];
    renderItinList();
  }
  function renderItinList() {
    var box = document.getElementById('sentitin-list'); if (!box) return;
    var rows = state.allItins || []; box.textContent = '';
    if (!rows.length) { box.appendChild(emptyBox('itinerary', 'No itineraries yet', 'Send a trip and it appears here, with share links and duplicates one click away.')); return; }
    var needle = (state.itSearch || '').trim().toLowerCase();
    var shown = !needle ? rows : rows.filter(function (row) { return ((row.itinerary_number || '') + ' ' + (row.title || '') + ' ' + (row.destination || '') + ' ' + (row.customer_email || '') + ' ' + findCustomerNameByEmail(row.customer_email) + ' ' + (row.traveler_names || '')).toLowerCase().indexOf(needle) > -1; });
    if (!shown.length) { box.appendChild(h('p', { class: 'qf-empty', text: 'Nothing matches that search.' })); return; }
    box.appendChild(h('div', { class: 'sq-wrap' }, shown.map(itinListRow)));
  }
  function duplicateItinerary(row) {
    state.docCustomer = findCustomerForDoc(row);
    state.builderTab = 'itinerary';
    state.itinDraft = { title: row.title || '', destination: row.destination || '', trip_type: row.trip_type || null, start_date: row.start_date || null, end_date: row.end_date || null, pax_adults: row.pax_adults != null ? row.pax_adults : 1, pax_children: row.pax_children || 0, pax_infants: row.pax_infants || 0, traveler_names: row.traveler_names || '', segments: row.segments || [], hotels: row.hotels || [], transport: row.transport || [], entertainment: row.entertainment || [], cruises: row.cruises || [], day_notes: row.day_notes || [], documents: row.documents || [], notes: row.notes || '', total_charged: row.total_charged || null, comparable_total: row.comparable_total || null, currency: row.currency || 'USD', price_invoice_number: row.price_invoice_number || null, city_images: row.city_images || null };
    state.draftId = null;
    state.itinFlash = { kind: 'note', text: 'Duplicated from ' + (row.itinerary_number || 'the itinerary') + '. Change the customer or details, then send as a new itinerary.' };
    state.itinView = 'form'; state.tab = 'itineraries'; refreshNav(); renderTab();
  }
  async function deleteItinRow(row) {
    try { await sb.from('itineraries').delete().eq('id', row.id); } catch (e) { console.warn('delete itinerary failed', e); }
    loadSentItins();
  }
  function itinListRow(row) {
    var cust = findCustomerForDoc(row);
    var counts = [];
    var nf = (row.segments || []).length, nh = (row.hotels || []).length, ne = (row.entertainment || []).length;
    if (nf) counts.push(nf + (nf > 1 ? ' flights' : ' flight'));
    if (nh) counts.push(nh + (nh > 1 ? ' hotels' : ' hotel'));
    if (ne) counts.push(ne + (ne > 1 ? ' experiences' : ' experience'));
    var sub = [row.itinerary_number, row.destination || row.title, [row.start_date ? fmtDate(row.start_date) : '', row.end_date ? fmtDate(row.end_date) : ''].filter(Boolean).join(' – '), counts.join(', ')].filter(Boolean).join('  ·  ');
    return h('div', { class: 'sq-card' }, [
      h('div', { class: 'sq-main' }, [
        h('div', { class: 'sq-top' }, [h('div', { class: 'sq-name', text: fullName(cust) || row.customer_email || 'Customer' })]),
        sub ? h('div', { class: 'sq-sub', text: sub }) : null
      ]),
      h('div', { class: 'sq-actions' }, [
        h('button', { type: 'button', class: 'btn btn-primary', style: 'width:auto; padding:8px 14px', onclick: function () { adminOverlay(itinDetail(row), 'Itinerary ' + (row.itinerary_number || '')); }, text: 'View' }),
        h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto; padding:8px 14px', onclick: function () { editItinerary(row); }, text: 'Edit & resend' }),
        row.share_token ? h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto; padding:8px 14px', title: 'Anyone with this link can view the itinerary, no sign-in needed', onclick: function (e) {
          var link = 'https://flyupgrade.com/account/?trip=' + row.share_token, btn = e.target;
          function done() { btn.textContent = 'Link copied ✓'; setTimeout(function () { btn.textContent = 'Copy link'; }, 1800); }
          if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(done).catch(function () { window.prompt('Copy this link:', link); });
          else window.prompt('Copy this link:', link);
        }, text: 'Copy link' }) : null,
        h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto; padding:8px 14px', onclick: function () { duplicateItinerary(row); }, text: 'Duplicate' }),
        h('button', { type: 'button', class: 'btn btn-ghost pkg-del-btn', style: 'width:auto; padding:8px 14px', onclick: function () { confirmDialog({ title: 'Delete itinerary', message: 'Delete ' + (row.itinerary_number || 'this itinerary') + '?', detail: 'It disappears from the customer\u2019s account and any share links stop working. This cannot be undone.', danger: true, confirmText: 'Delete itinerary', onConfirm: function () { deleteItinRow(row); } }); }, text: 'Delete' })
      ])
    ]);
  }
  function itinDetail(row) {
    var cust = findCustomerForDoc(row), node = h('div', { class: 'qd' });
    node.appendChild(h('div', { class: 'qd-head' }, [
      h('div', null, [h('h3', { class: 'qd-title', text: row.title || ('Itinerary ' + (row.itinerary_number || '')) }), h('div', { class: 'qd-sub', text: [fullName(cust), row.customer_email].filter(Boolean).join('  ·  ') })])
    ]));
    var chips = [row.itinerary_number, ttLabel(row.trip_type), row.destination, paxLabel(row), row.created_at ? 'Sent ' + fmtDate(row.created_at) : ''].filter(Boolean);
    node.appendChild(h('div', { class: 'qd-chips' }, chips.map(function (c) { return h('span', { class: 'qd-chip', text: c }); })));
    function group(title, items) { if (!items.length) return; node.appendChild(h('h4', { class: 'qd-h', text: title })); node.appendChild(h('div', { class: 'qd-flights' }, items)); }
    group('Flights', (row.segments || []).map(function (s) {
      return h('div', { class: 'qd-seg' }, [
        s.connect_from_prev ? h('div', { class: 'rev-line', text: '↳ ' + layoverLabel(s) }) : null,
        h('div', { class: 'rev-strong', text: ((s.from && s.from.code) || '?') + ' → ' + ((s.to && s.to.code) || '?') + ((s.airline || s.cabin) ? '  ·  ' + [s.airline, s.cabin].filter(Boolean).join(' ') : '') }),
        h('div', { class: 'rev-line', text: [s.depart_date ? fmtDate(s.depart_date) : '', s.flight_number].filter(Boolean).join('  ·  ') })
      ]);
    }));
    group('Hotels', (row.hotels || []).map(function (x) { return h('div', { class: 'qd-seg' }, [h('div', { class: 'rev-strong', text: x.name || '' }), h('div', { class: 'rev-line', text: [x.location, x.room].filter(Boolean).join('  ·  ') })]); }));
    group('Transport', (row.transport || []).map(function (x) { return h('div', { class: 'qd-seg' }, [h('div', { class: 'rev-strong', text: x.type || '' }), h('div', { class: 'rev-line', text: [x.from, x.to].filter(Boolean).join(' → ') })]); }));
    group('Dining & experiences', (row.entertainment || []).map(function (x) { return h('div', { class: 'qd-seg' }, [h('div', { class: 'rev-strong', text: x.name || '' }), h('div', { class: 'rev-line', text: [x.category, x.location].filter(Boolean).join('  ·  ') })]); }));
    return node;
  }
  function editItinerary(row) {
    state.docCustomer = findCustomerForDoc(row);
    state.builderTab = 'itinerary';
    state.itinDraft = { editing_id: row.id, editing_number: row.itinerary_number, title: row.title || '', destination: row.destination || '', trip_type: row.trip_type || null, start_date: row.start_date || null, end_date: row.end_date || null, pax_adults: row.pax_adults != null ? row.pax_adults : 1, pax_children: row.pax_children || 0, pax_infants: row.pax_infants || 0, traveler_names: row.traveler_names || '', segments: row.segments || [], hotels: row.hotels || [], transport: row.transport || [], entertainment: row.entertainment || [], cruises: row.cruises || [], day_notes: row.day_notes || [], documents: row.documents || [], notes: row.notes || '', total_charged: row.total_charged || null, comparable_total: row.comparable_total || null, currency: row.currency || 'USD', price_invoice_number: row.price_invoice_number || null, city_images: row.city_images || null };
    state.itinFlash = { kind: 'note', text: 'Editing ' + (row.itinerary_number || 'this itinerary') + '. Make your changes (photos too), then review & resend — it updates the version in their account.' };
    state.itinView = 'form'; state.tab = 'itineraries'; refreshNav(); renderTab();
  }
  function itinSection(title, containerId, cards, addLabel, addFn, bare) {
    var empty = !cards || !cards.length;
    var sec = h('div', { class: (bare ? 'gt-subsec' : 'inv-section') + (empty ? ' sec-slim' : '') }, [
      h('h3', { class: bare ? 'gt-subsec-h' : 'inv-h3', text: title }),
      h('div', { id: containerId, class: 'itin-cards' }, cards),
      h('button', { type: 'button', class: 'inv-addline', onclick: function () { sec.classList.remove('sec-slim'); addFn(); }, text: addLabel })
    ]);
    return sec;
  }
  function itinForm(d) {
    d = d || {};
    var segs = (d.segments && d.segments.length) ? d.segments : [null];
    var custBox = h('div', { id: 'inv-cust', class: 'inv-cust' });
    var form = h('form', { class: 'inv-form', onsubmit: toReviewItin }, [
      templateBar(),
      quoteStartBar('itinerary'),
      h('div', { class: 'inv-section' }, [h('h3', { class: 'inv-h3', text: 'Customer' }), customerSearch(), custBox]),
      h('div', { class: 'inv-section' }, [
        h('h3', { class: 'inv-h3', text: 'Trip' }),
        invField('Trip title', 'itin-title', 'text', 'e.g. Dubai First Class Getaway', d.title),
        h('p', { class: 'inv-sublabel', style: 'margin:6px 0 0', text: 'Destination and dates fill in automatically from the flights below.' }),
        h('p', { class: 'inv-sublabel', style: 'margin-top:16px', text: 'Travelers' }),
        h('div', { class: 'inv-row3' }, [paxField('Adults (12+)', 'itin-adults', d.pax_adults != null ? d.pax_adults : 1), paxField('Children (2–11)', 'itin-children', d.pax_children != null ? d.pax_children : 0), paxField('Infants (under 2)', 'itin-infants', d.pax_infants != null ? d.pax_infants : 0)]),
        h('div', { class: 'inv-field', style: 'margin-top:14px' }, [h('span', { text: 'Traveler names (optional). Shown on the itinerary; the counts above fill in automatically.' }), travelerRows({ id: 'itin-names', value: d.traveler_names || '', seed: state.docCustomer ? { title: state.docCustomer.title || 'Mr', first: state.docCustomer.first_name || '', last: state.docCustomer.last_name || '', type: 'Adult' } : null, onChange: function (c, total) { if (!total) return; var a = document.getElementById('itin-adults'), ch = document.getElementById('itin-children'), inf = document.getElementById('itin-infants'); if (a) a.value = c.Adult || 0; if (ch) ch.value = c.Child || 0; if (inf) inf.value = c.Infant || 0; } })])
      ]),
      h('div', { class: 'inv-section' }, [
        h('h3', { class: 'inv-h3', text: 'Flights' }),
        flightsSection(segs, detectTripType(d))
      ]),
      itinSection('Hotels', 'itin-hotels', (d.hotels || []).map(hotelCard), '+ Add hotel', function () { var c = hotelCard(); document.getElementById('itin-hotels').appendChild(c); initDatePickers(c); }),
      itinSection('Transportation', 'itin-transport', (d.transport || []).map(transportCard), '+ Add transport', function () { var c = transportCard(); document.getElementById('itin-transport').appendChild(c); initDatePickers(c); }),
      itinSection('Dining', 'itin-dining', (d.entertainment || []).filter(function (x) { return x.kind === 'dining'; }).map(diningCard), '+ Add dining', function () { var c = diningCard(); document.getElementById('itin-dining').appendChild(c); initDatePickers(c); }),
      itinSection('Entertainment', 'itin-ent', (d.entertainment || []).filter(function (x) { return x.kind !== 'dining'; }).map(entCard), '+ Add experience', function () { var c = entCard(); document.getElementById('itin-ent').appendChild(c); initDatePickers(c); }),
      itinSection('Cruises', 'itin-cruises', (d.cruises || []).map(cruiseCard), '+ Add cruise', function () { var c = cruiseCard(); document.getElementById('itin-cruises').appendChild(c); initDatePickers(c); }),
      itinSection('Day by day (optional)', 'itin-days', (d.day_notes || []).map(dayCard), '+ Add a day note', function () { var c = dayCard(); document.getElementById('itin-days').appendChild(c); initDatePickers(c); }),
      itinSection('Travel documents (optional)', 'itin-docs', (d.documents || []).map(docCard), '+ Add document', function () { var c = docCard(); document.getElementById('itin-docs').appendChild(c); }),
      h('div', { class: 'inv-section' }, [
        h('h3', { class: 'inv-h3', text: 'Pricing & savings (optional)' }),
        h('p', { class: 'inv-sublabel', style: 'margin:-2px 0 14px', text: "Powers the savings figure on the customer's beautiful itinerary. Pull it from an invoice, or type it in." }),
        h('div', { class: 'inv-row2' }, [
          h('label', { class: 'inv-field' }, [h('span', { text: 'Pull from invoice no.' }), h('div', { class: 'itin-pull-row' }, [h('input', { id: 'itin-pull-inv', class: 'inv-input', type: 'text', placeholder: 'e.g. INV-100245', autocomplete: 'off', value: d.price_invoice_number || '' }), h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto; padding:0 16px; height:46px', onclick: pullInvoicePricing, text: 'Pull' })])]),
          h('div', { class: 'inv-field' }, [h('span', { class: 'seg-lookup-spacer', text: 'x' }), h('span', { id: 'itin-pull-status', class: 'seg-lookup-status', style: 'margin-top:13px' })])
        ]),
        h('div', { class: 'inv-row2' }, [invField('Your price (total)', 'itin-total', 'number', '0.00', d.total_charged), invField('Comparable / retail price', 'itin-comp', 'number', '0.00', d.comparable_total)]),
        h('input', { type: 'hidden', id: 'itin-cur', value: d.currency || (state.settings && state.settings.default_currency) || 'USD' })
      ]),
      h('div', { class: 'inv-section' }, [h('h3', { class: 'inv-h3', text: 'Notes (optional)' }), h('textarea', { id: 'itin-notes', class: 'inv-input inv-textarea', rows: '2', placeholder: 'Anything the customer should know.', value: d.notes || '' })]),
      h('div', { class: 'inv-submit' }, [h('span', { id: 'draft-ind', class: 'draft-ind', text: 'Auto-saving to this customer' }), h('div', { id: 'inv-msg', class: 'msg', style: 'display:none' }), h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto', onclick: function (e) { saveDraftNow(e.target); }, text: 'Save draft' }), h('button', { type: 'submit', class: 'btn btn-primary', style: 'width:auto; padding:13px 30px', text: 'Create & review' })])
    ]);
    setTimeout(function () { if (state.docCustomer) renderResolved(state.docCustomer); loadTemplates(); applyTripType(detectTripType(d)); initDatePickers(form); }, 0);
    return form;
  }
  function deriveTripMeta(segs, hotels) {
    segs = segs || []; hotels = hotels || [];
    var origin = segs[0] && segs[0].from && segs[0].from.code, seen = {}, cities = [];
    segs.forEach(function (sg) { var t = sg && sg.to; if (t && t.code && t.code !== origin && t.city && !seen[t.code]) { seen[t.code] = 1; cities.push(t.city); } });
    if (!cities.length) hotels.forEach(function (hx) { var c = ((hx.location || '').split(',')[0] || '').trim(); if (c && cities.indexOf(c) < 0) cities.push(c); });
    var dest = cities.slice(0, 3).join(' & ') || (segs[0] && segs[0].to && segs[0].to.city) || null;
    var starts = segs.map(function (sg) { return sg && sg.depart_date; }).filter(Boolean);
    hotels.forEach(function (hx) { if (hx.checkin_date) starts.push(hx.checkin_date); });
    var ends = segs.map(function (sg) { return sg && (admArriveDate(sg) || sg.arrive_date || sg.depart_date); }).filter(Boolean);
    hotels.forEach(function (hx) { if (hx.checkout_date) ends.push(hx.checkout_date); });
    starts.sort(); ends.sort();
    return { destination: dest, start: starts[0] || null, end: ends[ends.length - 1] || null };
  }
  function collectItin() {
    var pa = parseInt(val('itin-adults'), 10); if (isNaN(pa)) pa = 0;
    var pc = parseInt(val('itin-children'), 10) || 0, pi = parseInt(val('itin-infants'), 10) || 0;
    var _segs = readSegments(); var _hotels = readCards('itin-hotels', 'hotel'); var _meta = deriveTripMeta(_segs, _hotels);
    return { customer: state.docCustomer, title: val('itin-title'), destination: _meta.destination, start_date: _meta.start, end_date: _meta.end, pax_adults: pa, pax_children: pc, pax_infants: pi, passengers: (pa + pc + pi) || 1, traveler_names: val('itin-names') || null, trip_type: readTripType(), segments: _segs, hotels: _hotels, transport: readCards('itin-transport', 'transport'), entertainment: readCards('itin-dining', 'dining').concat(readCards('itin-ent', 'ent')), cruises: readCards('itin-cruises', 'cruise'), day_notes: readCards('itin-days', 'day'), documents: readCards('itin-docs', 'doc'), notes: val('itin-notes'), total_charged: parseFloat(val('itin-total')) || null, comparable_total: parseFloat(val('itin-comp')) || null, currency: val('itin-cur') || (state.settings && state.settings.default_currency) || 'USD', price_invoice_number: val('itin-pull-inv') || null };
  }
  async function pullInvoicePricing() {
    var num = (val('itin-pull-inv') || '').trim(), status = document.getElementById('itin-pull-status');
    function st(m, k) { if (status) { status.textContent = m; status.className = 'seg-lookup-status' + (k ? ' lk-' + k : ''); } }
    if (!num) { st('Enter an invoice number.', 'err'); return; }
    st('Looking up ' + num + '…', '');
    var r = await sb.from('invoices').select('total_charged, comparable_total, currency').ilike('invoice_number', num).maybeSingle();
    if (r.error || !r.data) { st('No invoice ' + num + ' found.', 'err'); return; }
    var t = document.getElementById('itin-total'), c = document.getElementById('itin-comp'), cur = document.getElementById('itin-cur');
    if (t) t.value = r.data.total_charged != null ? r.data.total_charged : '';
    if (c) c.value = r.data.comparable_total != null ? r.data.comparable_total : '';
    if (cur && r.data.currency) cur.value = r.data.currency;
    st('Pulled from ' + num + '.', 'ok');
  }
  function toReviewItin(e) {
    e.preventDefault();
    var msg = document.getElementById('inv-msg');
    if (!state.docCustomer) { showInvMsg(msg, 'Find and confirm a customer first.', 'err'); return; }
    var d = collectItin();
    if (!d.segments.length && !d.hotels.length && !d.transport.length && !d.entertainment.length && !(d.cruises && d.cruises.length) && !(d.day_notes && d.day_notes.length)) { showInvMsg(msg, 'Add at least one thing to the trip: a flight, hotel, transfer, dining, experience or cruise.', 'err'); return; }
    if (roundTripGap(d)) { showInvMsg(msg, RT_GAP_MSG, 'err'); return; }
    if (!d.title) d.title = autoTitle(d);
    /* photo picks + edit-in-place identity survive re-collection */
    d.city_images = (state.itinDraft && state.itinDraft.city_images) || null;
    d.editing_id = (state.itinDraft && state.itinDraft.editing_id) || null;
    d.editing_number = (state.itinDraft && state.itinDraft.editing_number) || null;
    state.itinDraft = d; state.itinView = 'review'; state.revTab = 'beautiful'; renderTab();
  }
  /* ---- review: beautiful-itinerary preview (the REAL customer renderer in a frame) + image rail ---- */
  var _bvCandCb = null;
  window.addEventListener('message', function (ev) {
    var frB = document.getElementById('rev-bv-iframe'), frD = document.getElementById('rev-doc-iframe');
    var fr = (frB && ev.source === frB.contentWindow) ? frB : (frD && ev.source === frD.contentWindow) ? frD : null;
    if (!fr) return;
    var m = ev.data || {};
    if (m.type === 'bv-preview-ready') fr.contentWindow.postMessage({ type: 'bv-render', payload: bvPayload(state.itinDraft) }, '*');
    else if (m.type === 'bv-image-candidates' && _bvCandCb) { var cb = _bvCandCb; _bvCandCb = null; cb(m.candidates || []); }
  });
  function bvPayload(d) {
    d = d || {}; var p = d.customer || {};
    return { settings: state.settings || {}, profile: { first_name: p.first_name || '', last_name: p.last_name || '' }, itinerary: {
      itinerary_number: 'PREVIEW', title: d.title || null, destination: d.destination || null, trip_type: d.trip_type || null,
      start_date: d.start_date || null, end_date: d.end_date || null, pax_adults: d.pax_adults, pax_children: d.pax_children, pax_infants: d.pax_infants, passengers: d.passengers, traveler_names: d.traveler_names || null,
      segments: d.segments || [], hotels: d.hotels || [], transport: d.transport || [], entertainment: d.entertainment || [], cruises: d.cruises || [], day_notes: d.day_notes || [], documents: d.documents || [],
      notes: d.notes || null, total_charged: d.total_charged || null, comparable_total: d.comparable_total || null, currency: d.currency || 'USD',
      city_images: d.city_images || null
    } };
  }
  function bvRefreshPreview() { var fr = document.getElementById('rev-bv-iframe'); if (fr) fr.src = 'bvpreview/preview.html?' + Date.now(); }
  /* same-day/flagged passthrough rule as the customer view — stay cities get chapter photos */
  function admArriveDate(s) { if (!s || !s.depart_date) return ''; if (s.arrive_time && s.depart_time && s.arrive_time < s.depart_time) { var dt = new Date(s.depart_date + 'T12:00:00'); dt.setDate(dt.getDate() + 1); return dt.getFullYear() + '-' + ('0' + (dt.getMonth() + 1)).slice(-2) + '-' + ('0' + dt.getDate()).slice(-2); } return s.depart_date; }
  function admStayCities(segs) {
    segs = segs || []; var pass = {}, i;
    for (i = 1; i < segs.length; i++) {
      var s = segs[i], prev = segs[i - 1];
      if (!s || !s.from || !s.from.code || !prev || !prev.to || prev.to.code !== s.from.code) continue;
      if (s.connect_from_prev) { pass[s.from.code] = 1; continue; }
      var ad = prev.return_date || admArriveDate(prev);
      if (ad && s.depart_date && s.depart_date <= ad) pass[s.from.code] = 1;
    }
    var origin = segs[0] && segs[0].from && segs[0].from.code, out = [], seen = {};
    segs.forEach(function (sg) { var t = sg && sg.to; if (!t || !t.code || t.code === origin || pass[t.code] || seen[t.code] || !t.city) return; seen[t.code] = 1; out.push(t.city); });
    return out;
  }
  function bvImageSlots(d) {
    var slots = [];
    admStayCities(d.segments).forEach(function (c) {
      slots.push({ kind: 'city', label: c, sub: 'Chapter & hero photo', name: c, city: c, addr: '', cat: '',
        get: function () { return (d.city_images || {})[c] || ''; },
        set: function (u) { d.city_images = d.city_images || {}; if (u) d.city_images[c] = u; else delete d.city_images[c]; } });
    });
    function itemSlot(x, kind, label, sub, name, city, addr, cat) {
      slots.push({ kind: kind, label: label, sub: sub, name: name, city: city, addr: addr, cat: cat,
        get: function () { return x.image_url || ''; },
        set: function (u) { x.image_url = u || null; } });
    }
    (d.hotels || []).forEach(function (x) { itemSlot(x, 'hotel', x.name || 'Hotel', 'Hotel photo', x.name || '', x.location || '', x.address || '', ''); });
    (d.transport || []).forEach(function (x) { itemSlot(x, 'venue', x.type || 'Transfer', [x.from, x.to].filter(Boolean).join(' → ') || 'Transfer photo', x.car || x.type || '', ((x.to || x.from || '').split(',').pop() || '').trim(), '', [x.type, x.car].filter(Boolean).join(' ') || 'chauffeur'); });
    (d.entertainment || []).forEach(function (x) { itemSlot(x, 'venue', x.name || 'Experience', x.kind === 'dining' ? 'Dining photo' : 'Experience photo', x.name || '', ((x.location || '').split(',').pop() || '').trim(), x.address || '', x.category || ''); });
    return slots;
  }
  function bvRailRow(slot) {
    var thumb = h('div', { class: 'rail-thumb' + (slot.get() ? ' has-img' : '') });
    if (slot.get()) thumb.style.backgroundImage = 'url("' + slot.get().replace(/["\\\r\n]/g, '') + '")';
    else thumb.appendChild(h('span', { class: 'rail-auto', text: 'Auto' }));
    var row = h('div', { class: 'rail-row' }, [
      thumb,
      h('div', { class: 'rail-main' }, [h('div', { class: 'rail-name', text: slot.label }), h('div', { class: 'rail-sub', text: slot.sub })]),
      h('div', { class: 'rail-actions' }, [
        h('button', { type: 'button', class: 'rail-btn', onclick: function () { openImagePicker(slot, row); }, text: 'Choose' }),
        h('button', { type: 'button', class: 'rail-btn', onclick: function () { openImagePaste(slot, row); }, text: 'Paste' }),
        h('button', { type: 'button', class: 'rail-btn', title: 'Back to automatic image', onclick: function () { slot.set(''); refreshRailRow(row, slot); bvRefreshPreview(); }, text: 'Auto' })
      ])
    ]);
    return row;
  }
  function refreshRailRow(row, slot) {
    var t = row.querySelector('.rail-thumb'); if (!t) return;
    t.textContent = ''; t.classList.toggle('has-img', !!slot.get());
    if (slot.get()) t.style.backgroundImage = 'url("' + slot.get().replace(/["\\\r\n]/g, '') + '")';
    else { t.style.backgroundImage = ''; t.appendChild(h('span', { class: 'rail-auto', text: 'Auto' })); }
  }
  function openImagePicker(slot, row) {
    var grid = h('div', { class: 'imgpick-grid' }, [h('div', { class: 'imgpick-loading', text: 'Searching for photos of ' + (slot.name || slot.label) + '…' })]);
    adminOverlay(h('div', { class: 'imgpick' }, [
      h('p', { class: 'imgpick-hint', text: 'Verified photo candidates. Click one to use it on the itinerary.' }),
      grid
    ]), 'Choose a photo — ' + slot.label);
    var fr = document.getElementById('rev-bv-iframe');
    if (!fr || !fr.contentWindow) { grid.textContent = 'Preview is not ready yet — open the Beautiful itinerary tab first.'; return; }
    _bvCandCb = function (cands) {
      grid.textContent = '';
      if (!cands.length) { grid.appendChild(h('div', { class: 'imgpick-loading', text: 'No verified photos found. Try Paste with a photo URL of your own.' })); return; }
      cands.forEach(function (c) {
        var cell = h('button', { type: 'button', class: 'imgpick-cell', title: c.title || '' });
        cell.style.backgroundImage = 'url("' + (c.url || '').replace(/["\\\r\n]/g, '') + '")';
        cell.addEventListener('click', function () { slot.set(c.url); refreshRailRow(row, slot); closeAdminOverlay(); bvRefreshPreview(); });
        grid.appendChild(cell);
      });
    };
    fr.contentWindow.postMessage({ type: 'bv-find-images', slot: { kind: slot.kind, name: slot.name, city: slot.city, addr: slot.addr, cat: slot.cat } }, '*');
  }
  function openImagePaste(slot, row) {
    var inp = h('input', { class: 'inv-input', type: 'text', placeholder: 'https://… (a direct image link)', autocomplete: 'off' });
    adminOverlay(h('div', { class: 'imgpick' }, [
      h('p', { class: 'imgpick-hint', text: 'Paste a direct link to an image (ends in .jpg or .png, from any website).' }),
      inp,
      h('div', { class: 'adm-confirm-actions', style: 'margin-top:16px' }, [
        h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto', onclick: closeAdminOverlay, text: 'Cancel' }),
        h('button', { type: 'button', class: 'btn btn-primary', style: 'width:auto', onclick: function () { var u = (inp.value || '').trim(); if (!/^https:\/\//i.test(u)) { inp.focus(); return; } slot.set(u); refreshRailRow(row, slot); closeAdminOverlay(); bvRefreshPreview(); }, text: 'Use this photo' })
      ])
    ]), 'Paste a photo — ' + slot.label);
    setTimeout(function () { inp.focus(); }, 0);
  }
  function bvPreviewPane(d) {
    var rows = bvImageSlots(d).map(bvRailRow);
    return h('div', { class: 'rev-bv' }, [
      h('div', { class: 'rev-bv-frame' }, [h('iframe', { id: 'rev-bv-iframe', class: 'rev-bv-iframe', src: 'bvpreview/preview.html' })]),
      h('div', { class: 'rev-rail' }, [
        h('h4', { class: 'rev-h4', text: 'Photos' }),
        h('p', { class: 'rail-hint', text: 'Every photo the customer will see. Choose from verified candidates, paste your own, or leave on automatic.' }),
        h('div', { class: 'rail-rows' }, rows.length ? rows : [h('div', { class: 'rail-sub', text: 'No photo slots on this trip yet.' })])
      ])
    ]);
  }
  function reviewItin(d) {
    var p = d.customer, wrap = h('div', { class: 'inv-review' });
    wrap.appendChild(h('div', { class: 'rev-actions' }, [
      h('button', { class: 'btn btn-ghost', style: 'width:auto', onclick: function () { state.itinView = 'form'; renderTab(); }, text: '← Back to edit' }),
      h('div', { id: 'rev-msg', class: 'msg', style: 'display:none' }),
      h('button', { class: 'btn btn-primary', style: 'width:auto; padding:12px 26px', onclick: function (e) { sendItin(e.target); }, text: 'Send to customer' })
    ]));
    /* tabs: what the customer opens (the showpiece) vs the printable document */
    var bvPane, docPane;
    function selectTab(which) {
      state.revTab = which;
      bvPane.hidden = which !== 'beautiful'; docPane.hidden = which !== 'doc';
      if (which === 'doc') { var df = docPane.querySelector('#rev-doc-iframe'); if (df && !df.getAttribute('src')) df.setAttribute('src', df.getAttribute('data-src')); }
      Array.prototype.forEach.call(wrap.querySelectorAll('.rev-tab'), function (b) { b.classList.toggle('is-active', b.getAttribute('data-rt') === which); });
    }
    wrap.appendChild(h('div', { class: 'rev-tabs' }, [
      h('button', { type: 'button', class: 'rev-tab', 'data-rt': 'beautiful', onclick: function () { selectTab('beautiful'); }, text: 'Beautiful itinerary' }),
      h('button', { type: 'button', class: 'rev-tab', 'data-rt': 'doc', onclick: function () { selectTab('doc'); }, text: 'Document / PDF' })
    ]));
    bvPane = h('div', { class: 'rev-pane' }, [bvPreviewPane(d)]);
    wrap.appendChild(bvPane);
    /* the Document tab IS the customer's printable Loya PDF, rendered by the real
       customer code in a second frame (lazy: boots the first time the tab opens) */
    docPane = h('div', { class: 'rev-pane rev-docframe' }, [
      h('iframe', { id: 'rev-doc-iframe', class: 'rev-bv-iframe', 'data-src': 'bvpreview/preview.html?mode=doc' })
    ]);
    wrap.appendChild(docPane);
    selectTab(state.revTab === 'doc' ? 'doc' : 'beautiful');
    return wrap;
  }
  async function sendItin(btn) {
    var d = state.itinDraft, msg = document.getElementById('rev-msg');
    if (!d || !d.customer) { state.itinView = 'form'; renderTab(); return; }
    var payload = { customer_email: d.customer.email, account_number: d.customer.account_number || null, user_id: d.customer.id, title: d.title || null, destination: d.destination || null, trip_type: d.trip_type || null, start_date: d.start_date, end_date: d.end_date, passengers: d.passengers, pax_adults: d.pax_adults, pax_children: d.pax_children, pax_infants: d.pax_infants, traveler_names: d.traveler_names || null, segments: d.segments, hotels: d.hotels, transport: d.transport, entertainment: d.entertainment, cruises: d.cruises || [], day_notes: d.day_notes || [], documents: d.documents || [], notes: d.notes || null, total_charged: d.total_charged, comparable_total: d.comparable_total, price_invoice_number: d.price_invoice_number || null, city_images: (d.city_images && Object.keys(d.city_images).length) ? d.city_images : null };
    var editing = !!d.editing_id;
    btn.disabled = true; btn.textContent = editing ? 'Updating…' : 'Sending…';
    var r;
    if (editing) r = await sb.from('itineraries').update(payload).eq('id', d.editing_id).select().maybeSingle();
    else r = await sb.from('itineraries').insert(payload).select().maybeSingle();
    btn.disabled = false; btn.textContent = 'Send to customer';
    if (r.error) { showInvMsg(msg, r.error.message || 'Could not send.', 'err'); return; }
    clearCurrentDraft();
    var num = (r.data && r.data.itinerary_number) || d.editing_number || '';
    state.itinFlash = { kind: 'ok', text: editing ? ('Itinerary ' + num + ' updated — the version in ' + fullName(d.customer) + '’s account is now current.') : ('Itinerary ' + num + ' sent to ' + fullName(d.customer) + '. It is now in their account.') };
    state.docCustomer = null; state.itinDraft = null; state.itinView = 'form'; renderTab();
  }

  /* ===================== GROUP TRIPS =====================
     One trip for a whole family/group who fly in from different cities: build the
     SHARED journey once, then add a "city group" (pod) per departure/return city;
     generate one itinerary per pod (its own flights + the shared middle), all under
     the same account (one shared login) OR a linked group (separate logins). */
  function gtBlank() {
    return { view: 'list', editing_id: null, target_kind: 'account', customer: null, group: null, groups: null, name: '', title: '', destination: '', start_date: null, end_date: null, currency: (state.settings && state.settings.default_currency) || 'USD', total_charged: null, comparable_total: null, price_invoice_number: null, notes: '', shared: { segments: [], trip_type: null, hotels: [], transport: [], entertainment: [], cruises: [], day_notes: [], documents: [] }, city_images: null, pods: [], podDraft: null, podIndex: null };
  }
  function tabGroupTrips() {
    if (!state.gt) state.gt = gtBlank();
    var v = state.gt.view;
    if (v === 'setup') return gtBuildView();
    return gtListView();
  }
  /* reusable customer type-ahead that just calls back with the picked profile */
  function miniCustomerSearch(ph, onPick) {
    var box = h('div', { class: 'cs-wrap' });
    var input = h('input', { class: 'inv-input', type: 'text', placeholder: ph || 'Search customers…', autocomplete: 'off' });
    var menu = h('div', { class: 'cs-menu', style: 'display:none' });
    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase(); menu.textContent = '';
      if (q.length < 2) { menu.style.display = 'none'; return; }
      var ms = (state.customers || []).filter(function (c) { return (fullName(c) + ' ' + (c.email || '') + ' ' + (c.account_number || '') + ' ' + (c.phone || '')).toLowerCase().indexOf(q) > -1; }).slice(0, 8);
      if (!ms.length) { menu.appendChild(h('div', { class: 'cs-opt cs-none', text: 'No matches' })); menu.style.display = 'block'; return; }
      ms.forEach(function (c) {
        var opt = h('div', { class: 'cs-opt' }, [avatarBox(c, 'cust-av'), h('div', { class: 'cust-row-meta' }, [h('div', { class: 'cust-row-name', text: fullName(c) }), h('div', { class: 'cust-row-sub', text: (c.email || '') + (c.account_number ? '  ·  #' + c.account_number : '') })])]);
        opt.addEventListener('mousedown', function (e) { e.preventDefault(); input.value = ''; menu.style.display = 'none'; onPick(c); });
        menu.appendChild(opt);
      });
      menu.style.display = 'block';
    });
    input.addEventListener('blur', function () { setTimeout(function () { menu.style.display = 'none'; }, 160); });
    box.appendChild(input); box.appendChild(menu); return box;
  }
  function gtSeg(active, opts, onPick) {
    return h('div', { class: 'trip-type-ctl' }, opts.map(function (o) {
      return h('button', { type: 'button', class: 'tt-btn' + (o[0] === active ? ' is-active' : ''), onclick: function () { if (o[0] !== active) onPick(o[0]); }, text: o[1] });
    }));
  }
  function gtCustChip(c) {
    return h('div', { class: 'inv-confirm' }, [avatarBox(c, 'cust-av'),
      h('div', { class: 'cust-row-meta' }, [h('div', { class: 'cust-row-name', text: [c.title, fullName(c)].filter(Boolean).join(' ') }), h('div', { class: 'cust-row-sub', text: (c.email || '') + (c.account_number ? '  ·  #' + c.account_number : '') })]),
      h('button', { type: 'button', class: 'inv-confirm-clear', title: 'Change', onclick: function () { state.gt.customer = null; var b = document.getElementById('gt-cust-box'); if (b) { b.textContent = ''; b.appendChild(miniCustomerSearch('Search the family account…', function (nc) { state.gt.customer = nc; b.textContent = ''; b.appendChild(gtCustChip(nc)); })); } }, text: '×' })]);
  }
  async function loadGtGroupsData() {
    var r = await sb.from('travel_groups').select('*, travel_group_members(*)').order('created_at', { ascending: false });
    if (state.gt) state.gt.groups = r.data || [];
    return r.data || [];
  }
  function gtGroupControl() {
    var wrap = h('div', { id: 'gt-group-ctl' }, [h('div', { class: 'dash-loading', text: 'Loading groups…' })]);
    setTimeout(fillGtGroups, 0);
    return wrap;
  }
  async function fillGtGroups() {
    var g = state.gt; if (!g) return;
    if (g.groups == null) await loadGtGroupsData();
    var box = document.getElementById('gt-group-ctl'); if (!box) return; box.textContent = '';
    box.appendChild(h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto; margin-bottom:12px', onclick: gtNewGroupModal, text: '+ New linked group' }));
    var groups = g.groups || [];
    if (!groups.length) { box.appendChild(h('p', { class: 'inv-sublabel', text: 'No linked groups yet. Create one to link separate customer logins so they see each other’s trips.' })); return; }
    var list = h('div', { class: 'gt-grouplist' });
    groups.forEach(function (gr) {
      var sel = g.group && g.group.id === gr.id, mem = (gr.travel_group_members || []);
      list.appendChild(h('button', { type: 'button', class: 'gt-grouprow' + (sel ? ' is-sel' : ''), onclick: function () { g.group = gr; fillGtGroups(); } }, [
        h('div', { class: 'gt-grouprow-main' }, [h('b', { text: gr.name }), h('span', { class: 'gt-grouprow-sub', text: mem.length + ' member' + (mem.length !== 1 ? 's' : '') })]),
        sel ? h('span', { class: 'gt-check', text: '✓' }) : null
      ]));
    });
    box.appendChild(list);
    if (g.group) {
      var mem2 = (g.group.travel_group_members || []);
      box.appendChild(h('div', { class: 'gt-members' }, mem2.length ? mem2.map(function (m) { return h('span', { class: 'gt-chip', text: m.customer_email || '(member)' }); }) : [h('span', { class: 'inv-sublabel', text: 'This group has no members yet — add them below.' })]));
      box.appendChild(h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto; margin-top:10px', onclick: function () { gtAddMemberModal(g.group); }, text: '+ Add member to this group' }));
    }
  }
  function gtMemberAdder() {
    var members = [];
    var chips = h('div', { class: 'gt-members' });
    function render() { chips.textContent = ''; members.forEach(function (m, i) { chips.appendChild(h('span', { class: 'gt-chip' }, [h('span', { text: m.name }), h('button', { type: 'button', class: 'gt-chip-x', onclick: function () { members.splice(i, 1); render(); }, text: '×' })])); }); }
    var adder = miniCustomerSearch('Search customers to add…', function (c) { if (!members.some(function (m) { return m.customer_id === c.id; })) { members.push({ customer_id: c.id, customer_email: c.email, name: fullName(c) }); render(); } });
    return { members: members, node: h('div', null, [adder, chips]) };
  }
  function gtNewGroupModal() {
    var nameInp = h('input', { class: 'inv-input', type: 'text', placeholder: 'e.g. The Ahmed Family', autocomplete: 'off' });
    var ma = gtMemberAdder(), msg = h('div', { class: 'msg', style: 'display:none' });
    async function save() {
      var nm = (nameInp.value || '').trim(); if (!nm) { showInvMsg(msg, 'Give the group a name.', 'err'); return; }
      var r = await sb.from('travel_groups').insert({ name: nm }).select().maybeSingle();
      if (r.error || !r.data) { showInvMsg(msg, (r.error && r.error.message) || 'Could not create group.', 'err'); return; }
      var gid = r.data.id;
      if (ma.members.length) { var mr = await sb.from('travel_group_members').insert(ma.members.map(function (m) { return { group_id: gid, customer_id: m.customer_id, customer_email: m.customer_email }; })); if (mr.error) { showInvMsg(msg, mr.error.message || 'Group made, but adding members failed.', 'err'); } }
      closeAdminOverlay(); await loadGtGroupsData(); state.gt.group = (state.gt.groups || []).filter(function (x) { return x.id === gid; })[0] || null; fillGtGroups();
    }
    adminOverlay(h('div', { class: 'gt-newgroup' }, [
      h('label', { class: 'inv-field' }, [h('span', { text: 'Group name' }), nameInp]),
      h('p', { class: 'inv-sublabel', style: 'margin-top:14px', text: 'Members — each keeps their own login and sees the whole group’s trips.' }),
      ma.node, msg,
      h('div', { class: 'adm-confirm-actions', style: 'margin-top:18px' }, [h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto', onclick: closeAdminOverlay, text: 'Cancel' }), h('button', { type: 'button', class: 'btn btn-primary', style: 'width:auto', onclick: save, text: 'Create group' })])
    ]), 'New linked group');
  }
  function gtAddMemberModal(group) {
    var ma = gtMemberAdder(), msg = h('div', { class: 'msg', style: 'display:none' });
    async function save() {
      if (!ma.members.length) { closeAdminOverlay(); return; }
      var r = await sb.from('travel_group_members').upsert(ma.members.map(function (m) { return { group_id: group.id, customer_id: m.customer_id, customer_email: m.customer_email }; }), { onConflict: 'group_id,customer_id' });
      if (r.error) { showInvMsg(msg, r.error.message || 'Could not add members.', 'err'); return; }
      closeAdminOverlay(); await loadGtGroupsData(); state.gt.group = (state.gt.groups || []).filter(function (x) { return x.id === group.id; })[0] || state.gt.group; fillGtGroups();
    }
    adminOverlay(h('div', { class: 'gt-newgroup' }, [
      h('p', { class: 'inv-sublabel', text: 'Add existing customer accounts to “' + group.name + '”.' }),
      ma.node, msg,
      h('div', { class: 'adm-confirm-actions', style: 'margin-top:18px' }, [h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto', onclick: closeAdminOverlay, text: 'Cancel' }), h('button', { type: 'button', class: 'btn btn-primary', style: 'width:auto', onclick: save, text: 'Add members' })])
    ]), 'Add members');
  }
  function gtCollectAll() {
    var g = state.gt; if (!g) return;
    g.name = val('gt-name');
    g.total_charged = parseFloat(val('itin-total')) || null; g.comparable_total = parseFloat(val('itin-comp')) || null;
    g.currency = val('itin-cur') || g.currency || 'USD'; g.price_invoice_number = val('itin-pull-inv') || null;
    g.notes = val('gt-notes');
    if (document.getElementById('inv-segs')) {
      /* firstCanConnect: the first shared flight (e.g. Istanbul -> Destination 1) may be marked a
         connection, because after generation it follows each group's arrival into the meeting city */
      g.shared = { segments: readLegsFrom(document.getElementById('inv-segs'), true), trip_type: readTripType(), hotels: readCards('itin-hotels', 'hotel'), transport: readCards('itin-transport', 'transport'), entertainment: readCards('itin-dining', 'dining').concat(readCards('itin-ent', 'ent')), cruises: readCards('itin-cruises', 'cruise'), day_notes: readCards('itin-days', 'day'), documents: readCards('itin-docs', 'doc') };
      g.destination = gtDeriveDest(g.shared); /* auto from the shared flights (or hotels), no field to fill */
    }
    var itinEls = document.querySelectorAll('.gt-itin');
    if (itinEls.length) {
      var pods = [];
      Array.prototype.forEach.call(itinEls, function (c) {
        var pax = parseInt((c.querySelector('.gt-i-pax') || {}).value, 10); if (isNaN(pax) || pax < 1) pax = null;
        var pt = parseFloat((c.querySelector('.gt-i-total') || {}).value); if (isNaN(pt)) pt = null;
        var pcp = parseFloat((c.querySelector('.gt-i-comp') || {}).value); if (isNaN(pcp)) pcp = null;
        pods.push({
          label: ((c.querySelector('.gt-i-label') || {}).value || '').trim(),
          title: ((c.querySelector('.gt-i-title') || {}).value || '').trim() || null,
          pax: pax,
          travelers: ((c.querySelector('.gt-i-travelers') || {}).value || '').trim(),
          total: pt, comp: pcp,
          out_segments: readLegsFrom(c.querySelector('.inv-segs[data-leg="out"]')),
          ret_segments: readLegsFrom(c.querySelector('.inv-segs[data-leg="ret"]'))
        });
      });
      g.pods = pods;
    }
  }
  /* the trip's destinations = the shared journey's stop cities (or, with no flights, the hotel cities) */
  function gtDeriveDest(shared) {
    shared = shared || {};
    var segs = shared.segments || []; var hub = segs[0] && segs[0].from && segs[0].from.code, seen = {}, cities = [];
    segs.forEach(function (sg) { var t = sg && sg.to; if (t && t.code && t.code !== hub && t.city && !seen[t.code]) { seen[t.code] = 1; cities.push(t.city); } });
    if (!cities.length) (shared.hotels || []).forEach(function (hx) { var c = ((hx.location || '').split(',')[0] || '').trim(); if (c && cities.indexOf(c) < 0) cities.push(c); });
    return cities.slice(0, 3).join(' & ') || null;
  }
  function gtBuildView() {
    state.gtBuilding = true;
    var g = state.gt, wrap = h('div');
    if (!g.pods.length) g.pods = [{ label: '', title: null, pax: null, travelers: '', total: null, comp: null, out_segments: [], ret_segments: [] }];
    wrap.appendChild(mainHead(g.editing_id ? 'Edit group trip' : 'New group trip', 'One trip, several itineraries. Build the shared part once, then fill in each itinerary’s own start, travelers and flights.'));
    var body = h('div', { class: 'main-body' });
    if (state.gtFlash) { body.appendChild(flashEl(state.gtFlash, false)); state.gtFlash = null; }
    body.appendChild(gtItinBanner());
    var segs = (g.shared.segments && g.shared.segments.length) ? g.shared.segments : [null];
    var n = g.pods.length;
    var form = h('form', { class: 'inv-form', onsubmit: function (e) { e.preventDefault(); gtGenerate(); } }, [
      h('div', { class: 'inv-section' }, [
        h('h3', { class: 'inv-h3', text: 'Trip setup' }),
        h('p', { class: 'inv-sublabel', style: 'margin:-2px 0 14px', text: 'Who signs in to see it, and a name for your list. Dates and destination fill in automatically from the flights.' }),
        invField('Trip name (for your list)', 'gt-name', 'text', 'e.g. Loya Family — Croatia & Dubai', g.name),
        h('span', { class: 'gt-fieldlbl', style: 'margin-top:14px', text: 'Who is this trip for?' }),
        gtSeg(g.target_kind, [['account', 'One shared login'], ['group', 'Linked group (separate logins)']], function (k) { gtCollectAll(); g.target_kind = k; renderTab(); }),
        g.target_kind === 'account'
          ? h('div', { style: 'margin-top:12px' }, [h('div', { id: 'gt-cust-box' }, g.customer ? [gtCustChip(g.customer)] : [miniCustomerSearch('Search the family account…', function (c) { g.customer = c; var b = document.getElementById('gt-cust-box'); if (b) { b.textContent = ''; b.appendChild(gtCustChip(c)); } })])])
          : h('div', { style: 'margin-top:12px' }, [h('p', { class: 'inv-sublabel', style: 'margin-bottom:8px', text: 'Each traveler keeps their own login; the group links them so everyone sees every itinerary.' }), gtGroupControl()])
      ]),
      h('div', { class: 'inv-section' }, [
        h('div', { class: 'gt-count-head' }, [
          h('div', null, [h('h3', { class: 'inv-h3', style: 'margin:0', text: 'Itineraries' }), h('p', { class: 'inv-sublabel', style: 'margin:4px 0 0', text: 'One per starting point (e.g. Detroit, Chicago). Choose how many — you fill each one in below the shared trip.' })]),
          h('div', { class: 'gt-count-pick' }, [h('span', { class: 'gt-count-lbl', text: 'How many?' }), gtCountStepper(n)])
        ])
      ]),
      h('div', { class: 'inv-section' }, [
        h('h3', { class: 'inv-h3', text: 'The shared trip' }),
        h('p', { class: 'inv-sublabel', style: 'margin:-2px 0 6px', text: 'Built once and added to every itinerary: the flights from the meeting point onward, plus every hotel, transfer, meal and experience they do together.' }),
        templateBar(),
        h('div', { class: 'gt-subsec' }, [h('h3', { class: 'gt-subsec-h', text: 'Flights — from the meeting point onward' }), flightsSection(segs, null, { plain: true })]),
        itinSection('Hotels', 'itin-hotels', (g.shared.hotels || []).map(hotelCard), '+ Add hotel', function () { var c = hotelCard(); document.getElementById('itin-hotels').appendChild(c); initDatePickers(c); }, true),
        itinSection('Transfers', 'itin-transport', (g.shared.transport || []).map(transportCard), '+ Add transfer', function () { var c = transportCard(); document.getElementById('itin-transport').appendChild(c); initDatePickers(c); }, true),
        itinSection('Dining', 'itin-dining', (g.shared.entertainment || []).filter(function (x) { return x.kind === 'dining'; }).map(diningCard), '+ Add dining', function () { var c = diningCard(); document.getElementById('itin-dining').appendChild(c); initDatePickers(c); }, true),
        itinSection('Experiences', 'itin-ent', (g.shared.entertainment || []).filter(function (x) { return x.kind !== 'dining'; }).map(entCard), '+ Add experience', function () { var c = entCard(); document.getElementById('itin-ent').appendChild(c); initDatePickers(c); }, true),
        itinSection('Cruises', 'itin-cruises', (g.shared.cruises || []).map(cruiseCard), '+ Add cruise', function () { var c = cruiseCard(); document.getElementById('itin-cruises').appendChild(c); initDatePickers(c); }, true),
        itinSection('Day by day', 'itin-days', (g.shared.day_notes || []).map(dayCard), '+ Add a day note', function () { var c = dayCard(); document.getElementById('itin-days').appendChild(c); initDatePickers(c); }, true),
        itinSection('Documents', 'itin-docs', (g.shared.documents || []).map(docCard), '+ Add document', function () { var c = docCard(); document.getElementById('itin-docs').appendChild(c); }, true)
      ]),
      h('div', { class: 'inv-section' }, [
        h('h3', { class: 'inv-h3', text: 'Fill in each itinerary' }),
        h('p', { class: 'inv-sublabel', style: 'margin:-2px 0 14px', text: 'Each starting point’s travelers, title and its own flights to and from home. The shared trip above is added to every one.' }),
        h('div', { class: 'gt-itins' }, g.pods.map(gtItinCard))
      ]),
      h('div', { class: 'inv-section' }, [
        h('h3', { class: 'inv-h3', text: 'Pricing & notes (optional)' }),
        h('p', { class: 'inv-sublabel', style: 'margin:-2px 0 14px', text: 'Used for every itinerary unless a group has its own price set on its card above. Pull from an invoice or type it in.' }),
        h('div', { class: 'inv-row2' }, [
          h('label', { class: 'inv-field' }, [h('span', { text: 'Pull from invoice no.' }), h('div', { class: 'itin-pull-row' }, [h('input', { id: 'itin-pull-inv', class: 'inv-input', type: 'text', placeholder: 'e.g. INV-100245', autocomplete: 'off', value: g.price_invoice_number || '' }), h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto; padding:0 16px; height:46px', onclick: pullInvoicePricing, text: 'Pull' })])]),
          h('div', { class: 'inv-field' }, [h('span', { class: 'seg-lookup-spacer', text: 'x' }), h('span', { id: 'itin-pull-status', class: 'seg-lookup-status', style: 'margin-top:13px' })])
        ]),
        h('div', { class: 'inv-row2' }, [invField('Your price (total, per itinerary)', 'itin-total', 'number', '0.00', g.total_charged), invField('Comparable / retail price', 'itin-comp', 'number', '0.00', g.comparable_total)]),
        h('input', { type: 'hidden', id: 'itin-cur', value: g.currency || 'USD' }),
        h('label', { class: 'inv-field', style: 'margin-top:16px' }, [h('span', { text: 'Notes (shown on every itinerary)' }), h('textarea', { id: 'gt-notes', class: 'inv-input inv-textarea', rows: '2', placeholder: 'Anything the travelers should know.', value: g.notes || '' })])
      ]),
      h('div', { class: 'inv-submit' }, [
        h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto; padding:13px 24px', onclick: function () { confirmDialog({ title: 'Leave group trip', message: 'Leave without saving?', detail: 'Anything typed into this group trip is lost. \u201cSave for later\u201d keeps it instead.', danger: true, confirmText: 'Leave', onConfirm: function () { state.gt = gtBlank(); renderTab(); } }); }, text: 'Cancel' }),
        h('div', { id: 'gt-msg', class: 'msg', style: 'display:none' }),
        h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto', onclick: function (e) { gtSaveOnly(e.target); }, text: 'Save for later' }),
        h('button', { type: 'submit', id: 'gt-generate-btn', class: 'btn btn-primary', style: 'width:auto; padding:13px 30px', text: 'Generate ' + n + ' itinerar' + (n === 1 ? 'y' : 'ies') })
      ])
    ]);
    body.appendChild(form); wrap.appendChild(body);
    setTimeout(function () { relabelSegs(); loadTemplates(); initDatePickers(form); }, 0);
    return wrap;
  }
  function gtCountStepper(n) {
    return h('div', { class: 'gt-stepper' }, [
      h('button', { type: 'button', class: 'gt-step-btn', title: 'One fewer', onclick: function () { gtSetCount(state.gt.pods.length - 1); }, text: '−' }),
      h('span', { class: 'gt-step-n', text: '' + n }),
      h('button', { type: 'button', class: 'gt-step-btn', title: 'One more', onclick: function () { gtSetCount(state.gt.pods.length + 1); }, text: '+' })
    ]);
  }
  function gtSetCount(n) {
    var g = state.gt; gtCollectAll();
    n = Math.max(1, Math.min(10, n));
    while (g.pods.length < n) g.pods.push({ label: '', title: null, pax: null, travelers: '', total: null, comp: null, out_segments: [], ret_segments: [] });
    while (g.pods.length > n) g.pods.pop();
    renderTab();
  }
  function gtItinCard(pod, i) {
    var sharedR = gtSharedRoute(state.gt.shared.segments), meet = sharedR ? sharedR.split(' → ')[0] : 'the meeting point';
    var pax = gtPodPax(pod);
    var summ = [pod.title, pax + ' traveler' + (pax > 1 ? 's' : '')].filter(Boolean).join('   ·   ');
    var body = h('div', { class: 'gt-itin-body' }, [
      h('div', { class: 'inv-row2', style: 'margin-bottom:16px' }, [
        h('label', { class: 'inv-field' }, [h('span', { text: 'Starting point' }), h('input', { class: 'inv-input gt-i-label', type: 'text', placeholder: 'e.g. Detroit', autocomplete: 'off', value: pod.label || '' })]),
        h('label', { class: 'inv-field' }, [h('span', { text: 'Display title (shown to the customer)' }), h('input', { class: 'inv-input gt-i-title', type: 'text', placeholder: 'Defaults to the trip name', autocomplete: 'off', value: pod.title || '' })])
      ]),
      h('div', { class: 'inv-row3', style: 'margin-bottom:16px' }, [
        h('label', { class: 'inv-field' }, [h('span', { text: 'Number of travelers' }), h('input', { class: 'inv-input gt-i-pax', type: 'number', min: '1', step: '1', value: pod.pax != null ? pod.pax : '' })]),
        h('label', { class: 'inv-field' }, [h('span', { text: 'This group\u2019s price (optional)' }), h('input', { class: 'inv-input gt-i-total', type: 'number', min: '0', step: '0.01', placeholder: 'Uses trip pricing if blank', value: pod.total != null ? pod.total : '' })]),
        h('label', { class: 'inv-field' }, [h('span', { text: 'Comparable price (optional)' }), h('input', { class: 'inv-input gt-i-comp', type: 'number', min: '0', step: '0.01', placeholder: 'Retail they would pay', value: pod.comp != null ? pod.comp : '' })])
      ]),
      h('div', { class: 'inv-field' }, [h('span', { text: 'Traveler names (optional). The count above fills in automatically.' }), travelerRows({ cls: 'gt-i-travelers', value: pod.travelers || '', onChange: function (c, total, wrapEl) { if (!total || !wrapEl) return; var host = wrapEl.closest('.gt-itin'); var paxEl = host && host.querySelector('.gt-i-pax'); if (paxEl) paxEl.value = total; } })]),
      h('p', { class: 'gt-sub-label', style: 'margin-top:14px', text: 'Their flight(s) to ' + meet + ' — departure' }),
      podLegs('out', podOut(pod)),
      h('div', { class: 'gt-mid-note' }, [h('span', { class: 'gt-mid-line' }), h('span', { class: 'gt-mid-text', text: sharedR ? 'Shared trip  ·  ' + sharedR : 'The shared trip goes here' }), h('span', { class: 'gt-mid-line' })]),
      h('p', { class: 'gt-sub-label', text: 'Their flight(s) home from ' + meet + ' — return' }),
      podLegs('ret', podRet(pod))
    ]);
    var card = h('div', { class: 'gt-itin is-open' });
    var head = h('div', { class: 'gt-itin-head' }, [
      h('div', { class: 'gt-itin-head-main' }, [h('span', { class: 'gt-itin-num', text: 'Itinerary ' + (i + 1) }), h('span', { class: 'gt-itin-summ', text: (pod.label ? pod.label + (summ ? '   ·   ' + summ : '') : summ) })]),
      h('div', { class: 'gt-itin-head-act' }, [
        state.gt.pods.length > 1 ? h('button', { type: 'button', class: 'gt-itin-rm', title: 'Remove this itinerary', onclick: function (e) { e.stopPropagation(); confirmDialog({ title: 'Remove itinerary', message: 'Remove \u201c' + (pod.label || ('Itinerary ' + (i + 1))) + '\u201d from this group trip?', detail: 'Its travelers and flights are removed from the builder.', danger: true, confirmText: 'Remove', onConfirm: function () { gtCollectAll(); state.gt.pods.splice(i, 1); renderTab(); } }); }, text: '×' }) : null,
        h('span', { class: 'gt-itin-chev' })
      ])
    ]);
    head.addEventListener('click', function (e) { if (e.target.closest('.gt-itin-rm')) return; card.classList.toggle('is-open'); });
    card.appendChild(head); card.appendChild(body);
    return card;
  }
  function gtItinBanner() {
    return h('div', { class: 'gt-banner' }, [
      h('span', { class: 'gt-banner-tag', text: 'Itinerary' }),
      h('span', { class: 'gt-banner-text', text: 'One trip, several itineraries. Build the shared part once; each departure city becomes its own full itinerary in the account.' })
    ]);
  }
  function gtSharedRoute(segs) {
    segs = segs || []; if (!segs.length) return '';
    var codes = [];
    segs.forEach(function (s) { var f = s && s.from && s.from.code, t = s && s.to && s.to.code; if (f && codes[codes.length - 1] !== f) codes.push(f); if (t) codes.push(t); });
    return codes.join(' → ');
  }
  function gtSharedExtras(s) {
    var b = [], nh = (s.hotels || []).length, nt = (s.transport || []).length, ne = (s.entertainment || []).length;
    if (nh) b.push(nh + ' hotel' + (nh > 1 ? 's' : '')); if (nt) b.push(nt + ' transfer' + (nt > 1 ? 's' : '')); if (ne) b.push(ne + ' experience' + (ne > 1 ? 's' : ''));
    return b.length ? '  ·  ' + b.join(' · ') : '';
  }
  function gtPodPax(pod) { if (pod && pod.pax && pod.pax > 0) return pod.pax; var n = ((pod && pod.travelers) || '').split(/[\n,]+/).map(function (x) { return x.trim(); }).filter(Boolean).length; return n || 1; }
  /* a self-contained (class-scoped, no shared IDs) flight list so a pod can have TWO of them */
  function podLegs(kind, segs) {
    var list = h('div', { class: 'inv-segs', 'data-leg': kind }, (segs && segs.length ? segs : [null]).map(segRow));
    var add = h('button', { type: 'button', class: 'inv-addline', text: '+ Add flight' });
    add.addEventListener('click', function () { var r = segRow(); list.appendChild(r); renumberLegs(list); initDatePickers(r); });
    setTimeout(function () { renumberLegs(list); }, 0);
    return h('div', { class: 'flights-wrap' }, [list, add]);
  }
  function gtHubCode() { var s = state.gt.shared.segments || []; return s[0] && s[0].from && s[0].from.code; }
  function podOut(pod) { return pod.out_segments || (pod.segments ? gtSplitPod(pod.segments, gtHubCode()).out : []); }
  function podRet(pod) { return pod.ret_segments || (pod.segments ? gtSplitPod(pod.segments, gtHubCode()).ret : []); }
  function gtOwner() {
    var g = state.gt;
    if (g.target_kind === 'account') { if (!g.customer) return null; return { customer_email: g.customer.email, account_number: g.customer.account_number || null, user_id: g.customer.id || null, group_id: null }; }
    if (!g.group || !g.group.id) return null;
    var mem = (g.group.travel_group_members || []);
    return { customer_email: (mem[0] && mem[0].customer_email) || '', account_number: null, user_id: (mem[0] && mem[0].customer_id) || null, group_id: g.group.id };
  }
  async function gtPersist(owner) {
    var g = state.gt;
    var payload = { name: g.name || 'Group trip', target_kind: g.target_kind, customer_email: owner.customer_email || null, account_number: owner.account_number, user_id: owner.user_id, group_id: owner.group_id, title: null, destination: g.destination || null, start_date: g.start_date || null, end_date: g.end_date || null, currency: g.currency || 'USD', total_charged: g.total_charged, comparable_total: g.comparable_total, notes: g.notes || null, shared: g.shared || {}, pods: g.pods || [], city_images: (g.city_images && Object.keys(g.city_images).length) ? g.city_images : null };
    var r;
    if (g.editing_id) r = await sb.from('group_trips').update(payload).eq('id', g.editing_id).select('id').maybeSingle();
    else r = await sb.from('group_trips').insert(payload).select('id').maybeSingle();
    if (r.error || !r.data) throw (r.error || new Error('persist failed'));
    g.editing_id = r.data.id;
    return r.data.id;
  }
  async function gtSaveOnly(btn) {
    gtCollectAll();
    var g = state.gt, owner = gtOwner();
    if (!owner) { var m = document.getElementById('gt-msg'); if (m) showInvMsg(m, g.target_kind === 'account' ? 'Pick the shared account first.' : 'Pick or create a linked group first.', 'err'); return; }
    btn.disabled = true; btn.textContent = 'Saving…';
    try { await gtPersist(owner); } catch (e) { btn.disabled = false; btn.textContent = 'Save for later'; var m2 = document.getElementById('gt-msg'); if (m2) showInvMsg(m2, 'Could not save the group trip.', 'err'); return; }
    state.gt = gtBlank(); state.gtFlash = { kind: 'note', text: 'Group trip saved. You can open it any time to generate the itineraries.' }; renderTab();
  }
  function gtSplitPod(podSegs, hub) {
    var out = [], ret = [], hit = false;
    (podSegs || []).forEach(function (s) {
      if (!hit) { out.push(s); if (s && s.to && s.to.code === hub) hit = true; }
      else ret.push(s);
    });
    return { out: out, ret: ret };
  }
  function gtComposedDates(segs) {
    var ds = segs.map(function (s) { return s && s.depart_date; }).filter(Boolean).slice().sort();
    var last = segs[segs.length - 1];
    return { start: ds[0] || null, end: last ? (admArriveDate(last) || last.depart_date || null) : null };
  }
  async function gtGenerate() {
    gtCollectAll();
    var g = state.gt, msg = document.getElementById('gt-msg');
    function err(m) { if (msg) showInvMsg(msg, m, 'err'); }
    var owner = gtOwner();
    if (!owner) { err(g.target_kind === 'account' ? 'Pick the shared account first.' : 'Pick or create a linked group first.'); return; }
    if (g.target_kind === 'group' && !((g.group.travel_group_members || []).length)) { err('Add at least one member to the linked group.'); return; }
    var s = g.shared;
    if (!(s.segments && s.segments.length) && !(s.hotels && s.hotels.length) && !(s.transport && s.transport.length) && !(s.entertainment && s.entertainment.length) && !(s.cruises && s.cruises.length) && !(s.day_notes && s.day_notes.length)) { err('Build the shared trip first. Add at least one shared flight, hotel, transfer, dining, experience or cruise.'); return; }
    var filled = g.pods.filter(function (p) { return (p.label || '').trim() || podOut(p).length || podRet(p).length; });
    if (!filled.length) { err('Fill in at least one itinerary (a starting point and its flights).'); return; }
    var btn = document.getElementById('gt-generate-btn'); if (btn) { btn.disabled = true; btn.textContent = 'Generating…'; }
    var gtId; try { gtId = await gtPersist(owner); } catch (e) { gtId = null; }
    if (!gtId) { if (btn) { btn.disabled = false; btn.textContent = 'Generate itineraries'; } err('Could not save the group trip.'); return; }
    try { await sb.from('itineraries').delete().eq('group_trip_id', gtId); } catch (e) { }
    var rows = filled.map(function (pod) {
      var composed = podOut(pod).concat(g.shared.segments || [], podRet(pod));
      var dates = gtComposedDates(composed), pax = gtPodPax(pod);
      return {
        customer_email: owner.customer_email, account_number: owner.account_number, user_id: owner.user_id,
        group_id: owner.group_id, group_trip_id: gtId, traveler_names: pod.travelers || null,
        title: (pod.title || g.name || pod.label), destination: g.destination || null, trip_type: 'multi',
        start_date: dates.start, end_date: dates.end,
        passengers: pax, pax_adults: pax, pax_children: 0, pax_infants: 0,
        segments: composed, hotels: g.shared.hotels || [], transport: g.shared.transport || [], entertainment: g.shared.entertainment || [], cruises: g.shared.cruises || [], day_notes: g.shared.day_notes || [], documents: g.shared.documents || [],
        notes: g.notes || null, total_charged: (pod.total != null ? pod.total : g.total_charged), comparable_total: (pod.comp != null ? pod.comp : g.comparable_total), currency: g.currency || 'USD',
        price_invoice_number: g.price_invoice_number || null, city_images: (g.city_images && Object.keys(g.city_images).length) ? g.city_images : null
      };
    });
    var r = await sb.from('itineraries').insert(rows).select('id');
    if (btn) { btn.disabled = false; btn.textContent = 'Generate itineraries'; }
    if (r.error) { err(r.error.message || 'Could not generate the itineraries.'); return; }
    var n = rows.length;
    state.gt = gtBlank(); state.gtFlash = { kind: 'ok', text: n + ' itinerar' + (n === 1 ? 'y' : 'ies') + ' generated' + (g.target_kind === 'account' ? ' in the shared account' : ' for the group') + '. They are now in the customer account' + (n > 1 ? 's' : '') + '.' };
    renderTab();
  }
  function gtListView() {
    var wrap = h('div');
    wrap.appendChild(mainHead('Group trips', 'One trip for a whole family or group flying in from different cities — we generate an itinerary per city, all under their account.'));
    var body = h('div', { class: 'main-body' });
    if (state.gtFlash) { body.appendChild(flashEl(state.gtFlash, false)); state.gtFlash = null; }
    body.appendChild(h('button', { class: 'btn btn-primary', style: 'width:auto; margin-bottom:18px', onclick: function () { state.gt = gtBlank(); state.gt.view = 'setup'; renderTab(); }, text: '+ New group trip' }));
    body.appendChild(h('div', { id: 'gt-list', class: 'pkg-list' }, [h('div', { class: 'dash-loading', text: 'Loading group trips…' })]));
    wrap.appendChild(body);
    setTimeout(loadGroupTrips, 0);
    return wrap;
  }
  async function loadGroupTrips() {
    var r = await sb.from('group_trips').select('*').order('created_at', { ascending: false });
    var box = document.getElementById('gt-list'); if (!box) return; box.textContent = '';
    var rows = r.data || [];
    if (!rows.length) { box.appendChild(h('div', { class: 'pkg-empty', text: 'No group trips yet. Click “+ New group trip” to build one.' })); return; }
    rows.forEach(function (row) { box.appendChild(gtTripRow(row)); });
  }
  function gtTripRow(row) {
    var pods = (row.pods || []);
    var sub = [row.destination, (pods.length + ' itinerar' + (pods.length === 1 ? 'y' : 'ies')), (row.target_kind === 'group' ? 'Linked group' : 'Shared account'), row.created_at ? ('Created ' + fmtDate(row.created_at)) : ''].filter(Boolean).join('  ·  ');
    return h('div', { class: 'pkg-card' }, [
      h('div', { class: 'pkg-card-main' }, [h('div', { class: 'pkg-card-name', text: row.name || row.title || 'Group trip' }), h('div', { class: 'pkg-card-sub', text: sub })]),
      h('div', { class: 'pkg-card-actions' }, [
        h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto', onclick: function () { gtLoadTrip(row); }, text: 'Edit / regenerate' }),
        h('button', { type: 'button', class: 'btn btn-ghost pkg-del-btn', style: 'width:auto', onclick: function () { confirmDialog({ title: 'Delete group trip', message: 'Delete “' + (row.name || row.title || 'this group trip') + '”?', detail: 'Removes the group-trip template. Itineraries already in customer accounts are NOT deleted.', danger: true, confirmText: 'Delete', onConfirm: function () { gtDeleteTrip(row.id); } }); }, text: 'Delete' })
      ])
    ]);
  }
  async function gtLoadTrip(row) {
    var g = gtBlank();
    g.editing_id = row.id; g.target_kind = row.target_kind || 'account'; g.name = row.name || ''; g.title = row.title || ''; g.destination = row.destination || ''; g.start_date = row.start_date || null; g.end_date = row.end_date || null; g.currency = row.currency || 'USD'; g.total_charged = row.total_charged; g.comparable_total = row.comparable_total; g.notes = row.notes || ''; g.shared = row.shared || { segments: [], hotels: [], transport: [], entertainment: [] }; g.pods = row.pods || []; g.city_images = row.city_images || null;
    if (g.target_kind === 'account' && row.customer_email) { g.customer = (state.customers || []).filter(function (c) { return (c.email || '').toLowerCase() === row.customer_email.toLowerCase(); })[0] || { id: row.user_id, email: row.customer_email, first_name: row.customer_email, last_name: '', account_number: row.account_number }; }
    state.gt = g;
    if (g.target_kind === 'group' && row.group_id) { await loadGtGroupsData(); g.groups = state.gt.groups; g.group = (g.groups || []).filter(function (x) { return x.id === row.group_id; })[0] || null; }
    g.view = 'setup'; renderTab();
  }
  async function gtDeleteTrip(id) { try { await sb.from('group_trips').delete().eq('id', id); } catch (e) { console.warn('delete group trip failed', e); } if (document.getElementById('gt-list')) loadGroupTrips(); }

  sb.auth.onAuthStateChange(function (evt) { if (evt === 'SIGNED_OUT') { teardownRealtime(); viewLogin(); } });
  boot();
})();
