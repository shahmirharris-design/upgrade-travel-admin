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
    } catch (e) {
      viewLogin('Could not connect. Check your internet connection and try again.');
    }
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
    { label: 'Overview', items: [['dashboard', 'Dashboard'], ['trips', 'Trips'], ['tasks', 'Tasks'], ['reports', 'Reports']] },
    { label: 'Clients', items: [['customers', 'Customers'], ['quotes', 'Quotes'], ['invoices', 'Invoices'], ['itineraries', 'Itineraries'], ['grouptrips', 'Group trips']] },
    { label: 'Library', items: [['packages', 'Packages']] }
  ];
  function navButton(n) {
    var b = h('button', { class: state.tab === n[0] ? 'is-active' : '', 'data-tab': n[0] }, [svgIcon(ICONS[n[0]]), h('span', { text: n[1] })]);
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
  function signOut() { teardownRealtime(); state.customers = []; state.selectedId = null; sb.auth.signOut().then(function () { viewLogin(); }).catch(function () { viewLogin(); }); }
  function mainHead(title, sub) { return h('div', { class: 'main-head' }, [h('h1', { class: 'main-title', text: title }), sub ? h('p', { class: 'main-sub', text: sub }) : null]); }
  function renderTab() {
    var main = document.getElementById('main');
    Array.prototype.forEach.call(document.querySelectorAll('.flatpickr-calendar'), function (c) { c.remove(); });
    main.textContent = '';
    state.pkgBuilding = false; /* segRow rich mode is package-scoped; packageForm re-enables it */
    state.gtBuilding = false; /* group-trip shared/pod flights re-enable rich mode per view */
    if (state.tab === 'dashboard') main.appendChild(tabDashboard());
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
      sb.from('quotes').select('status, total_charged'),
      sb.from('invoices').select('total_charged, comparable_total, created_at'),
      sb.from('itineraries').select('id', { count: 'exact', head: true }),
      sb.from('tasks').select('*').eq('done', false).order('due_date', { ascending: true, nullsFirst: false })
    ]);
    dash = document.getElementById('dash'); if (!dash) return;
    var custCount = res[0].count || 0;
    var reqs = res[1].data || [], quotes = res[2].data || [], invoices = res[3].data || [];
    var itinCount = res[4].count || 0, ym = curYM();
    var newReqs = 0, monthReqs = 0;
    reqs.forEach(function (r) { if (r.status === 'new') newReqs++; if ((r.created_at || '').slice(0, 7) === ym) monthReqs++; });
    var qSent = 0, qAcc = 0, qDec = 0, pipeline = 0;
    quotes.forEach(function (q) { if (q.status === 'accepted') qAcc++; else if (q.status === 'declined') qDec++; else { qSent++; pipeline += dnum(q.total_charged); } });
    var decided = qAcc + qDec, acceptRate = decided ? Math.round((qAcc / decided) * 100) : 0;
    var revenue = 0, saved = 0, mRevenue = 0;
    invoices.forEach(function (inv) { var t = dnum(inv.total_charged); revenue += t; var c = dnum(inv.comparable_total); if (c > t) saved += (c - t); if ((inv.created_at || '').slice(0, 7) === ym) mRevenue += t; });
    var invCount = invoices.length, avgInv = invCount ? revenue / invCount : 0;

    dash.textContent = '';
    var tw = dashTasksWidget(res[5].data || [], todayISO()); if (tw) dash.appendChild(tw);
    dash.appendChild(h('div', { class: 'dash-row dash-hero' }, [
      statCard('Revenue billed', money(revenue, 'USD'), 'This month ' + money(mRevenue, 'USD'), 'gold'),
      statCard('Saved for clients', money(saved, 'USD'), 'across ' + invCount + ' invoice' + (invCount === 1 ? '' : 's'), 'green'),
      statCard('Customers', String(custCount), 'with an account', null),
      statCard('Open requests', String(newReqs), newReqs ? 'awaiting a quote' : 'all caught up', newReqs ? 'amber' : null)
    ]));
    var perf = h('div', { class: 'dash-panel' }, [
      h('div', { class: 'dash-panel-h', text: 'Quotes' }),
      h('div', { class: 'dash-funnel' }, [funnelStat('Pending', qSent, null), funnelStat('Accepted', qAcc, 'green'), funnelStat('Declined', qDec, 'red')]),
      h('div', { class: 'dash-rate' }, [
        h('div', { class: 'dash-rate-top' }, [h('span', { text: 'Acceptance rate' }), h('b', { text: decided ? acceptRate + '%' : '—' })]),
        h('div', { class: 'dash-rate-bar' }, [h('div', { class: 'dash-rate-fill', style: 'width:' + (decided ? acceptRate : 0) + '%' })])
      ])
    ]);
    var side = h('div', { class: 'dash-side' }, [
      statCard('Pipeline', money(pipeline, 'USD'), 'in ' + qSent + ' open quote' + (qSent === 1 ? '' : 's'), null),
      statCard('Itineraries', String(itinCount), 'trips planned', null)
    ]);
    dash.appendChild(h('div', { class: 'dash-row dash-2col' }, [perf, side]));
    dash.appendChild(h('div', { class: 'dash-row dash-mini' }, [
      statCard('Invoices', String(invCount), 'avg ' + money(avgInv, 'USD'), null),
      statCard('Quote requests', String(reqs.length), monthReqs + ' this month', null),
      statCard('Total quotes', String(quotes.length), qAcc + ' won · ' + qDec + ' lost', null),
      statCard('Avg saved / trip', money(invCount ? saved / invCount : 0, 'USD'), 'per invoice', null)
    ]));
    dash.appendChild(h('button', { type: 'button', class: 'dash-refresh', onclick: loadDashboard, text: '↻ Refresh' }));
  }
  function statCard(label, value, sub, accent) {
    return h('div', { class: 'dash-card' + (accent ? ' dash-card--' + accent : '') }, [
      h('div', { class: 'dash-k', text: label }), h('div', { class: 'dash-v', text: value }), sub ? h('div', { class: 'dash-sub', text: sub }) : null
    ]);
  }
  function funnelStat(label, n, accent) {
    return h('div', { class: 'dash-funnel-c' + (accent ? ' df-' + accent : '') }, [h('div', { class: 'dash-funnel-n', text: String(n) }), h('div', { class: 'dash-funnel-k', text: label })]);
  }
  /* ---------- reports ---------- */
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
    if (!active.length) box.appendChild(h('div', { class: 'task-empty', text: 'All clear — no open tasks.' }));
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
      h('button', { type: 'button', class: 'task-del', onclick: function () { deleteTask(t.id); }, title: 'Delete', text: '×' })
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
    var presets = [['all', 'All'], ['upcoming', 'Upcoming'], ['quoted', 'Quoted'], ['booked', 'Booked'], ['ticketed', 'Ticketed'], ['traveled', 'Travelled']];
    return h('div', { class: 'rep-presets', style: 'margin-bottom:18px' }, presets.map(function (pr) {
      return h('button', { type: 'button', class: 'rep-chip trip-chip' + ((state.tripFilter || 'all') === pr[0] ? ' is-on' : ''), 'data-f': pr[0], onclick: function () { state.tripFilter = pr[0]; Array.prototype.forEach.call(document.querySelectorAll('.trip-chip'), function (c) { c.classList.toggle('is-on', c.getAttribute('data-f') === pr[0]); }); renderTrips(); }, text: pr[1] });
    }));
  }
  function makeTrip(kind, row) {
    var seg = (row.segments || [])[0], depart = seg && seg.depart_date ? seg.depart_date : null;
    var stage = kind === 'quote' ? 'quoted' : (row.status === 'traveled' ? 'traveled' : (row.status === 'ticketed' ? 'ticketed' : 'booked'));
    return { kind: kind, row: row, number: row.quote_number || row.invoice_number, depart: depart, route: quoteRouteLabel(row), stage: stage, email: row.customer_email };
  }
  async function loadTrips() {
    var box = document.getElementById('trips-body'); if (!box) return;
    var res = await Promise.all([
      sb.from('quotes').select('id, quote_number, customer_email, segments, total_charged, currency, status').eq('status', 'sent').order('created_at', { ascending: false }),
      sb.from('invoices').select('id, invoice_number, customer_email, segments, total_charged, amount_paid, currency, status, created_at').order('created_at', { ascending: false })
    ]);
    box = document.getElementById('trips-body'); if (!box) return;
    var trips = [];
    (res[0].data || []).forEach(function (q) { trips.push(makeTrip('quote', q)); });
    (res[1].data || []).forEach(function (i) { trips.push(makeTrip('invoice', i)); });
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
    if (!trips.length) { box.appendChild(h('div', { class: 'task-empty', text: 'No trips in this view yet.' })); return; }
    box.appendChild(h('div', { class: 'trip-list' }, trips.map(tripCard)));
  }
  function tripCard(t) {
    var row = t.row, cur = row.currency || 'USD', today = todayISO();
    var stageLabels = { quoted: 'Quoted', booked: 'Booked', ticketed: 'Ticketed', traveled: 'Travelled' };
    var bits = [t.number, t.route, money(dnum(row.total_charged), cur)];
    var departTxt = t.depart ? fmtDate(t.depart) : 'No date';
    var departCls = t.depart && t.stage !== 'traveled' ? (t.depart < today ? ' is-over' : (t.depart <= addDays(today, 7) ? ' is-soon' : '')) : '';
    var payBadge = null;
    if (t.kind === 'invoice') {
      var total = dnum(row.total_charged), paid = dnum(row.amount_paid), st = total - paid <= 0.001 ? 'paid' : (paid > 0 ? 'partial' : 'unpaid');
      payBadge = h('span', { class: 'sq-badge inv-st-' + st, text: st === 'paid' ? 'Paid' : st === 'partial' ? 'Partial' : 'Unpaid' });
    }
    var actions = [];
    if (t.kind === 'quote') actions.push(h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto; padding:7px 13px', onclick: function () { convertQuoteToInvoice(row); }, text: '→ Invoice' }));
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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'quote_requests' }, function () { if (state.tab === 'quotes' && state.docView === 'form') loadRequests(); else if (state.tab === 'dashboard') loadDashboard(); });
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
      h('div', { id: 'cd-crm', class: 'cd-group cd-crm' }, [h('h4', { text: 'Concierge notes' }), h('div', { class: 'cd-hist-loading', text: 'Loading notes…' })]),
      h('div', { id: 'cd-history', class: 'cd-group cd-history' }, [h('h4', { text: 'History' }), h('div', { class: 'cd-hist-loading', text: 'Loading…' })]),
      h('div', { class: 'cd-actions' }, [
        h('button', { class: 'btn btn-primary', style: 'width:auto', onclick: function () { state.builderTab = 'quote'; state.docKind = 'quote'; state.docView = 'form'; state.docDraft = null; state.docCustomer = p; state.tab = 'quotes'; refreshNav(); renderTab(); }, text: 'New quote' }),
        h('button', { class: 'btn btn-ghost', onclick: function () { state.builderTab = 'invoice'; state.docKind = 'invoice'; state.docView = 'form'; state.docDraft = null; state.docCustomer = p; state.tab = 'invoices'; refreshNav(); renderTab(); }, text: 'New invoice' }),
        h('button', { class: 'btn btn-ghost', onclick: function () { state.builderTab = 'itinerary'; state.itinView = 'form'; state.itinDraft = null; state.docCustomer = p; state.tab = 'itineraries'; refreshNav(); renderTab(); }, text: 'New itinerary' }),
        h('button', { class: 'btn btn-ghost', onclick: function (e) { addReminderInline(p, e.target); }, text: '+ Reminder' })
      ])
    ]);
    right.appendChild(card);
    setTimeout(function () { loadCustomerHistory(p); loadCustomerCRM(p); }, 0);
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
        h('h3', { class: 'inv-h3', text: 'Invoicing & terms' }),
        h('label', { class: 'inv-field' }, [h('span', { text: 'Payment details (shown on invoices)' }), h('textarea', { id: 'set-payment', class: 'inv-input inv-textarea', rows: '3', placeholder: 'Wire / bank details, payment instructions…', value: s.payment_details || '' })]),
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
      h('div', { class: 'inv-submit' }, [h('div', { id: 'set-msg', class: 'msg', style: 'display:none' }), h('button', { type: 'submit', class: 'btn btn-primary', style: 'width:auto; padding:13px 30px', text: 'Save settings' })])
    ]);
  }
  async function saveSettings(e) {
    e.preventDefault();
    var btn = e.target.querySelector('button[type=submit]'), m = document.getElementById('set-msg');
    var payload = {
      id: 1,
      agency_name: val('set-name') || null, agency_tagline: val('set-tagline') || null, agency_phone: val('set-phone') || null, agency_email: val('set-email') || null, agency_address: val('set-address') || null,
      payment_details: val('set-payment') || null, invoice_terms: val('set-invterms') || null, quote_terms: val('set-qterms') || null,
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
          richField('Confirmation / PNR', 'seg-conf', seg && seg.confirmation, 'Booking reference'),
          richField('Operated by — ONLY if a different airline flies it', 'seg-opby', seg && seg.operated_by, 'Leave blank unless codeshare')
        ]),
        h('div', { class: 'inv-row3', style: 'margin-top:12px' }, [
          richField('Dep. terminal', 'seg-depterm', seg && seg.dep_terminal, 'e.g. 3'),
          richField('Arr. terminal', 'seg-arrterm', seg && seg.arr_terminal, 'e.g. 2'),
          richField('Seats', 'seg-seats', seg && seg.seats, 'e.g. 2A · 2K')
        ]),
        richField('Baggage allowance', 'seg-bag', seg && seg.baggage, 'e.g. 2 × 32 kg + carry-on'),
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
    if (add) add.textContent = type === 'round' ? '+ Add another flight (make it multi-city)' : '+ Add flight';
    Array.prototype.forEach.call(cards, function (card, i) {
      var role = card.querySelector('.seg-role'), label;
      if (type === 'round') label = i === 0 ? 'Outbound flight' : (i === 1 ? 'Return flight' : 'Flight ' + (i + 1));
      else if (type === 'one_way') label = cards.length > 1 ? 'Flight ' + (i + 1) : 'Flight details';
      else label = 'Flight ' + (i + 1);
      if (role) role.textContent = label;
    });
  }
  function flightsSection(segs, tripType, opts) {
    var plain = !!(opts && opts.plain); /* group trips: no round/one-way/multi control, just a flight list */
    var kids = [];
    if (!plain) kids.push(tripTypeControl(tripType));
    kids.push(h('div', { id: 'inv-segs', class: 'inv-segs' }, segs.map(segRow)));
    kids.push(h('button', { type: 'button', id: 'inv-add-flight', class: 'inv-addline', onclick: function () { var r = segRow(); document.getElementById('inv-segs').appendChild(r); relabelSegs(); initDatePickers(r); }, text: '+ Add flight' }));
    return h('div', { class: 'flights-wrap' }, kids);
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
    pick('.seg-seats', 'seats'); pick('.seg-layover-note', 'layover_note'); pick('.seg-conf', 'confirmation'); pick('.seg-opby', 'operated_by'); pick('.seg-depterm', 'dep_terminal'); pick('.seg-arrterm', 'arr_terminal'); pick('.seg-bag', 'baggage'); pick('.seg-notes', 'notes');
    var dist = parseInt((card.querySelector('.seg-distance') || {}).value, 10); if (dist > 0) seg.distance_km = dist;
    var cb = card.querySelector('.seg-connect-cb');
    if (cb && cb.checked && !isFirst) {
      seg.connect_from_prev = true;
      var kd = (card.querySelector('.seg-layover-kind') || {}).value || ''; if (kd) seg.layover_kind = kd;
      var ld = ((card.querySelector('.seg-layover-dur') || {}).value || '').trim(); if (ld) seg.layover_duration = ld;
    }
    return seg;
  }
  function readLegsFrom(container) {
    var segs = []; if (!container) return segs;
    Array.prototype.forEach.call(container.querySelectorAll('.seg-card'), function (card, i) { var s = readSeg(card, i === 0); if (s) segs.push(s); });
    return segs;
  }
  function readSegments() { return readLegsFrom(document.getElementById('inv-segs')); }
  function flightDesc(s) {
    var head = [s.airline, s.cabin].filter(Boolean).join(' ');
    var route = s.from.city + ' (' + s.from.code + ') to ' + s.to.city + ' (' + s.to.code + ')';
    return (head ? head + ' — ' : 'Flight — ') + route;
  }
  function flightDetail(s, pax) { var d = []; if (s.depart_date) d.push(fmtDate(s.depart_date)); if (pax) d.push(pax + ' traveller' + (pax > 1 ? 's' : '')); return d.join(' · ') || null; }
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
        opt.addEventListener('mousedown', function (e) { e.preventDefault(); state.docCustomer = c; input.value = ''; menu.style.display = 'none'; renderResolved(c); if (loadDraft(draftKind(), c.id)) renderTab(); else afterCustomerSelected(c); });
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
  function enterBuilder(b) { if (state.builderTab === b) return; state.builderTab = b; state.docCustomer = null; state.docDraft = null; state.docView = 'form'; state.docFlash = null; state.itinDraft = null; state.itinView = 'form'; }
  function enterDoc(kind) { state.docKind = kind; enterBuilder(kind); }
  /* ---------- per-customer auto-save drafts (localStorage — survives a crash or closing the app) ---------- */
  function draftKind() { return state.builderTab === 'itinerary' ? 'itinerary' : state.docKind; }
  function draftKey(kind, id) { return 'ut_draft_' + kind + '_' + id; }
  function draftHasContent(d) {
    if (!d) return false;
    var seg = (d.segments || []).some(function (s) { return s && (s.from || s.to || s.airline || s.flight_number); });
    var li = (d.line_items || []).some(function (i) { return i && (i.label || i.detail || i.amount); });
    return !!(d.title || d.destination || d.notes || d.booking_reference || d.comparable_total || d.total_charged || seg || li || (d.hotels && d.hotels.length) || (d.transport && d.transport.length) || (d.entertainment && d.entertainment.length));
  }
  function saveDraft() {
    try {
      if (!state.docCustomer || !state.docCustomer.id) return;
      var isItin = state.builderTab === 'itinerary';
      if (isItin ? state.itinView !== 'form' : state.docView !== 'form') return;
      if (!document.getElementById(isItin ? 'itin-title' : 'inv-title')) return;
      var d = isItin ? collectItin() : collectDraft();
      var kind = draftKind(), key = draftKey(kind, state.docCustomer.id);
      if (!draftHasContent(d)) { localStorage.removeItem(key); return; }
      var data = {}; Object.keys(d).forEach(function (k) { if (k !== 'customer') data[k] = d[k]; });
      localStorage.setItem(key, JSON.stringify({ saved_at: Date.now(), kind: kind, data: data }));
      var ind = document.getElementById('draft-ind'); if (ind) { ind.textContent = 'Draft saved'; ind.classList.add('is-on'); clearTimeout(saveDraft._t); saveDraft._t = setTimeout(function () { ind.classList.remove('is-on'); ind.textContent = 'Auto-saved for this customer'; }, 1800); }
    } catch (e) {}
  }
  function loadDraft(kind, id) { try { var raw = localStorage.getItem(draftKey(kind, id)); if (!raw) return null; var o = JSON.parse(raw); return (o && o.data) ? o : null; } catch (e) { return null; } }
  function clearDraft(kind, id) { try { localStorage.removeItem(draftKey(kind, id)); } catch (e) {} }
  function draftWhen(ts) { var diff = (Date.now() - ts) / 60000; if (diff < 1) return 'just now'; if (diff < 60) return Math.round(diff) + ' min ago'; var d = new Date(ts); return fmtDate(d.toISOString()) + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  function restoreDraftForCustomer() {
    if (!state.docCustomer || !state.docCustomer.id) return false;
    var isItin = state.builderTab === 'itinerary';
    if (isItin ? state.itinDraft : state.docDraft) return false;
    var kind = draftKind(), saved = loadDraft(kind, state.docCustomer.id);
    if (!saved || !draftHasContent(saved.data)) return false;
    var msg = 'Picked up where you left off (saved ' + draftWhen(saved.saved_at) + ').';
    if (isItin) { state.itinDraft = saved.data; state.itinFlash = { kind: 'note', text: msg, restore: true }; }
    else { state.docDraft = saved.data; state.docFlash = { kind: 'note', text: msg, restore: true }; }
    return true;
  }
  function startFresh(isItin) { if (state.docCustomer) clearDraft(draftKind(), state.docCustomer.id); if (isItin) state.itinDraft = null; else state.docDraft = null; renderTab(); }
  function flashEl(flash, isItin) {
    var el = h('div', { class: 'msg ' + flash.kind }, [h('span', { text: flash.text })]);
    if (flash.restore) el.appendChild(h('button', { type: 'button', class: 'msg-action', onclick: function () { startFresh(isItin); }, text: 'Start fresh instead' }));
    return el;
  }
  var _saveT = null;
  function scheduleSave() { if (!state.docCustomer) return; if (['invoices', 'quotes', 'itineraries'].indexOf(state.tab) < 0) return; clearTimeout(_saveT); _saveT = setTimeout(saveDraft, 900); }
  document.addEventListener('input', scheduleSave);
  document.addEventListener('change', scheduleSave);
  function tabInvoices() {
    enterDoc('invoice');
    var wrap = tabDoc();
    if (state.docView === 'form') {
      var body = wrap.querySelector('.main-body');
      if (body) { var box = h('div', { id: 'invlist-box' }); body.insertBefore(box, body.firstChild); setTimeout(loadInvoiceList, 0); }
    }
    return wrap;
  }
  function findCustomerNameByEmail(email) {
    if (!email) return ''; var e = email.toLowerCase();
    for (var i = 0; i < state.customers.length; i++) { if ((state.customers[i].email || '').toLowerCase() === e) return fullName(state.customers[i]); }
    return '';
  }
  async function loadInvoiceList() {
    var box = document.getElementById('invlist-box'); if (!box) return;
    var res = await Promise.all([
      sb.from('invoices').select('*').order('created_at', { ascending: false }).limit(25),
      sb.from('invoice_finance').select('invoice_id, net_cost')
    ]);
    box = document.getElementById('invlist-box'); if (!box) return;
    var invs = res[0].data || [], fin = res[1].data || [], costMap = {};
    fin.forEach(function (f) { costMap[f.invoice_id] = f.net_cost; });
    box.textContent = '';
    if (!invs.length) return;
    var outstanding = 0; invs.forEach(function (i) { outstanding += Math.max(dnum(i.total_charged) - dnum(i.amount_paid), 0); });
    box.appendChild(h('div', { class: 'sq-wrap' }, [
      h('div', { class: 'invlist-head' }, [h('h3', { class: 'sq-h', text: 'Invoices · ' + invs.length }), h('span', { class: 'invlist-out' + (outstanding > 0 ? ' is-due' : ''), text: outstanding > 0 ? money(outstanding, invs[0].currency || 'USD') + ' outstanding' : 'All settled ✓' })])
    ].concat(invs.map(function (inv) { return invoiceRow(inv, costMap[inv.id]); }))));
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
        h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto; padding:8px 14px', onclick: function () { editInvoice(inv, netCost); }, text: 'Edit & resend' })
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
    state.docDraft = { editing_id: inv.id, editing_number: inv.invoice_number, title: inv.title || '', destination: inv.destination || '', trip_type: inv.trip_type || null, segments: inv.segments || [], pax_adults: inv.pax_adults != null ? inv.pax_adults : 1, pax_children: inv.pax_children || 0, pax_infants: inv.pax_infants || 0, booking_reference: inv.booking_reference || '', line_items: inv.line_items || [], currency: inv.currency || 'USD', comparable_total: inv.comparable_total || null, deposit_paid: inv.deposit_paid || null, due_date: inv.due_date || null, net_cost: netCost != null ? netCost : null, notes: inv.notes || '' };
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
        var sq = h('div', { id: 'sentq-box' }); body.insertBefore(sq, body.firstChild); setTimeout(loadSentQuotes, 0);
        var box = h('div', { id: 'qreq-box' }); body.insertBefore(box, body.firstChild); setTimeout(loadRequests, 0);
      }
    }
    return wrap;
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
    var chips = [q.quote_number, ttLabel(q.trip_type), q.destination, paxLabel(q), q.created_at ? 'Sent ' + fmtDate(q.created_at) : '', q.valid_until ? 'Valid until ' + fmtDate(q.valid_until) : ''].filter(Boolean);
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
    state.docDraft = { editing_id: q.id, editing_number: q.quote_number, title: q.title || '', destination: q.destination || '', trip_type: q.trip_type || null, segments: q.segments || [], pax_adults: q.pax_adults != null ? q.pax_adults : 1, pax_children: q.pax_children || 0, pax_infants: q.pax_infants || 0, booking_reference: q.booking_reference || '', line_items: q.line_items || [], currency: q.currency || 'USD', comparable_total: q.comparable_total || null, valid_until: q.valid_until || null, notes: q.notes || '' };
    state.docFlash = { kind: 'note', text: 'Editing ' + (q.quote_number || 'this quote') + '. Make your changes, then review & resend — it updates the same quote.' };
    state.docView = 'form'; state.tab = 'quotes'; refreshNav(); renderTab();
  }
  async function loadSentQuotes() {
    var box = document.getElementById('sentq-box'); if (!box) return;
    var r = await sb.from('quotes').select('*').order('created_at', { ascending: false }).limit(60);
    box = document.getElementById('sentq-box'); if (!box) return;
    state.allQuotes = r.data || [];
    renderSentQuotes();
  }
  function renderSentQuotes() {
    var box = document.getElementById('sentq-box'); if (!box) return;
    var qs = state.allQuotes || []; box.textContent = '';
    if (!qs.length) return;
    var filt = state.quoteFilter || 'all';
    var counts = { all: qs.length, sent: 0, accepted: 0, declined: 0 };
    qs.forEach(function (q) { var s = q.status || 'sent'; if (counts[s] != null) counts[s]++; });
    var chips = [['all', 'All'], ['sent', 'Sent'], ['accepted', 'Accepted'], ['declined', 'Declined']].map(function (f) {
      return h('button', { type: 'button', class: 'qf-chip' + (filt === f[0] ? ' is-active' : ''), onclick: function () { state.quoteFilter = f[0]; renderSentQuotes(); }, text: f[1] + ' (' + (counts[f[0]] || 0) + ')' });
    });
    var shown = filt === 'all' ? qs : qs.filter(function (q) { return (q.status || 'sent') === filt; });
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
        h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto; padding:8px 14px', onclick: function () { convertQuoteToItinerary(q); }, text: '→ Itinerary' })
      ])
    ]);
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
    state.itinDraft = { title: q.title || '', destination: q.destination || '', trip_type: q.trip_type || null, start_date: s0 ? s0.depart_date : null, end_date: sN ? (sN.return_date || sN.depart_date) : null, pax_adults: q.pax_adults != null ? q.pax_adults : 1, pax_children: q.pax_children || 0, pax_infants: q.pax_infants || 0, segments: segs, hotels: [], transport: [], entertainment: [], notes: q.notes || '', total_charged: total, comparable_total: q.comparable_total || null, currency: q.currency || 'USD' };
    state.itinFlash = { kind: 'note', text: 'Started from quote ' + (q.quote_number || '') + ' — pricing carried over. Add hotels, transfers & experiences.' };
    state.itinView = 'form'; state.tab = 'itineraries'; refreshNav(); renderTab();
  }
  function quoteStartBar(target) {
    var section = h('div', { class: 'inv-section qstart' });
    section.appendChild(h('h3', { class: 'inv-h3', text: 'Start from a quote' }));
    section.appendChild(h('p', { class: 'inv-sublabel', style: 'margin:-2px 0 12px', text: 'Already quoted this customer? Search a quote to pull its flights, travellers and pricing straight in.' }));
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
  async function loadRequests() {
    var box = document.getElementById('qreq-box'); if (!box) return;
    var r = await sb.from('quote_requests').select('*').eq('status', 'new').order('created_at', { ascending: false });
    box = document.getElementById('qreq-box'); if (!box) return;
    var reqs = r.data || []; box.textContent = '';
    if (!reqs.length) return;
    box.appendChild(h('div', { class: 'qreq-wrap' }, [h('h3', { class: 'qreq-h', text: 'Incoming requests · ' + reqs.length })].concat(reqs.map(reqCard))));
  }
  function reqCard(req) {
    var pax = (req.adults || 0) + (req.children || 0) + (req.infants || 0), bits = [];
    if (req.trip) bits.push(req.trip);
    if (req.cabin) bits.push(req.cabin);
    if (pax) bits.push(pax + ' traveller' + (pax > 1 ? 's' : ''));
    if (req.depart) bits.push(req.depart + (req.return_date ? ' – ' + req.return_date : ''));
    return h('div', { class: 'qreq-card' }, [
      h('div', { class: 'qreq-top' }, [
        h('div', null, [h('div', { class: 'qreq-name', text: req.name || req.email || 'Quote request' }), h('div', { class: 'qreq-route', text: [req.route_from, req.route_to].filter(Boolean).join(' → ') })]),
        h('span', { class: 'qreq-deliv qreq-deliv--' + (req.delivery || 'account'), text: req.delivery === 'call' ? 'Wants a call' : 'Wants it in account' })
      ]),
      bits.length ? h('div', { class: 'qreq-meta', text: bits.join('  ·  ') }) : null,
      h('div', { class: 'qreq-foot' }, [
        h('div', { class: 'qreq-contact', text: [req.email, req.phone].filter(Boolean).join('  ·  ') }),
        h('div', { class: 'qreq-actions' }, [
          h('button', { type: 'button', class: 'btn btn-primary', style: 'width:auto; padding:8px 15px', onclick: function () { buildFromRequest(req); }, text: 'Link to account & build' }),
          h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto; padding:8px 13px', onclick: function () { archiveRequest(req.id); }, text: 'Dismiss' })
        ])
      ])
    ]);
  }
  function archiveRequest(id) { sb.from('quote_requests').update({ status: 'archived' }).eq('id', id).then(function () { loadRequests(); }).catch(function (e) { console.warn('archive request failed', e); }); }
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
    if (state.tab === 'grouptrips') { gtCollectSetup(); var gg = state.gt; d = { title: gg.title, destination: gg.destination, segments: gg.shared.segments, hotels: gg.shared.hotels, transport: gg.shared.transport, entertainment: gg.shared.entertainment, line_items: [], pax_adults: 2, pax_children: 0, pax_infants: 0, currency: gg.currency, comparable_total: gg.comparable_total }; }
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
    if (!pkgs.length) { box.appendChild(h('div', { class: 'pkg-empty', text: 'No packages yet. Click “+ New package” to build your first reusable trip.' })); return; }
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
        h('p', { class: 'inv-sublabel', style: 'margin-top:16px', text: 'Default travellers' }),
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
        h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto; padding:13px 24px', onclick: function () { state.pkgBuilding = false; state.pkgView = 'list'; state.pkgDraft = null; renderTab(); }, text: 'Cancel' }),
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
      gtCollectSetup();
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
      var A = window.UT_AIRPORTS || [], m = txt.toUpperCase().match(/\b([A-Z]{3})\b/), low = txt.toLowerCase(), c, j;
      if (m) { for (j = 0; j < A.length; j++) { if (A[j][0] === m[1]) { c = A[j]; break; } } }
      if (!c) {
        var a = searchAirports(txt);
        for (j = 0; j < a.length; j++) { if ((a[j][3] || '').toLowerCase().indexOf(low) > -1) { c = a[j]; break; } }
        if (!c) for (j = 0; j < a.length; j++) { if (/international|intercontinental/i.test(a[j][3] || '')) { c = a[j]; break; } }
        if (!c && a.length) c = a[0];
      }
      return c ? { code: c[0], city: c[1], country: c[2], name: c[3] } : null;
    }
    var f = resolve(req.route_from), t = resolve(req.route_to);
    var pd = parseToISODate(req.depart), rd = parseToISODate(req.return_date);
    var segs = (f && t) ? [{ airline: null, cabin: req.cabin || 'Business Class', from: f, to: t, depart_date: pd, return_date: rd }] : [];
    state.builderTab = 'quote'; state.docKind = 'quote';
    state.docDraft = { request_id: req.id, title: [req.route_from, req.route_to].filter(Boolean).join(' to '), segments: segs, pax_adults: req.adults != null ? req.adults : 1, pax_children: req.children || 0, pax_infants: req.infants || 0, line_items: [], currency: 'USD' };
    state.docFlash = { kind: 'note', text: 'Pre-filled from a quote request submitted ' + fmtDate(req.created_at) + '.' };
    state.docView = 'form'; renderTab();
  }
  function tabDoc() {
    var c = dcfg(), wrap = h('div');
    if (state.docView === 'review' && state.docDraft) { wrap.appendChild(mainHead(c.reviewTitle, 'Check everything, then send it to the customer.')); wrap.appendChild(h('div', { class: 'main-body' }, [reviewDoc(state.docDraft)])); return wrap; }
    restoreDraftForCustomer();
    wrap.appendChild(mainHead(c.title, c.sub));
    var body = h('div', { class: 'main-body' });
    if (state.docFlash) { body.appendChild(flashEl(state.docFlash, false)); state.docFlash = null; }
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
  function docForm(d) {
    d = d || {};
    var segs = (d.segments && d.segments.length) ? d.segments : [null];
    var lines = (d.line_items && d.line_items.length) ? d.line_items : [null];
    var custBox = h('div', { id: 'inv-cust', class: 'inv-cust' });
    var pricingRow2 = state.docKind === 'quote'
      ? h('div', { class: 'inv-row2' }, [invField('Valid until (optional)', 'inv-valid', 'date', '', d.valid_until), h('div')])
      : h('div', { class: 'inv-row2' }, [invField('Deposit paid (optional)', 'inv-deposit', 'number', '0.00', d.deposit_paid), invField('Balance due by (optional)', 'inv-due', 'date', '', d.due_date)]);
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
        h('p', { class: 'inv-sublabel', style: 'margin-top:18px', text: 'Travellers' }),
        h('div', { class: 'inv-row3' }, [paxField('Adults (12+)', 'inv-adults', d.pax_adults != null ? d.pax_adults : 1), paxField('Children (2–11)', 'inv-children', d.pax_children != null ? d.pax_children : 0), paxField('Infants (under 2)', 'inv-infants', d.pax_infants != null ? d.pax_infants : 0)]),
        h('div', { style: 'margin-top:14px' }, [invField('Booking reference (optional)', 'inv-ref', 'text', 'PNR / confirmation', d.booking_reference)])
      ]),
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
        costRow,
        h('div', { class: 'inv-totals' }, [totalRow('Total', 'inv-t-charged'), totalRow('Comparable', 'inv-t-comp'), totalRow('You saved', 'inv-t-saved', true)])
      ]),
      h('div', { class: 'inv-section' }, [h('h3', { class: 'inv-h3', text: 'Notes (optional)' }), h('textarea', { id: 'inv-notes', class: 'inv-input inv-textarea', rows: '2', placeholder: 'Anything the customer should know.', value: d.notes || '' })]),
      h('div', { class: 'inv-submit' }, [h('span', { id: 'draft-ind', class: 'draft-ind', text: 'Auto-saved for this customer' }), h('div', { id: 'inv-msg', class: 'msg', style: 'display:none' }), h('button', { type: 'submit', class: 'btn btn-primary', style: 'width:auto; padding:13px 30px', text: 'Create & review' })])
    ]);
    setTimeout(function () { if (state.docCustomer) renderResolved(state.docCustomer); recalc(); loadTemplates(); applyTripType(detectTripType(d)); }, 0);
    return form;
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
    return { customer: state.docCustomer, request_id: state.docDraft && state.docDraft.request_id || null, source_quote_id: state.docDraft && state.docDraft.source_quote_id || null, editing_id: state.docDraft && state.docDraft.editing_id || null, editing_number: state.docDraft && state.docDraft.editing_number || null, title: val('inv-title'), destination: dest, trip_type: tripType, segments: segs, pax_adults: pa, pax_children: pc, pax_infants: pi, passengers: (pa + pc + pi) || 1, booking_reference: val('inv-ref'), line_items: items, currency: val('inv-cur') || 'USD', comparable_total: parseFloat(val('inv-comp')) || null, deposit_paid: parseFloat(val('inv-deposit')) || null, net_cost: parseFloat(val('inv-cost')) || null, due_date: val('inv-due') || null, valid_until: val('inv-valid') || null, notes: val('inv-notes') };
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
    state.docDraft = d; state.docView = 'review'; renderTab();
  }
  function tline(k, v, due) { return h('div', { class: 'rev-tline' + (due ? ' rev-tline-due' : '') }, [h('span', { text: k }), h('span', { text: v })]); }
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
    if (kind === 'invoice' && state.settings && state.settings.payment_details) docEl.appendChild(h('div', { class: 'rev-notes' }, [h('h4', { class: 'rev-h4', text: 'Payment' }), h('p', { text: state.settings.payment_details })]));
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
      payload.deposit_paid = dep || null; payload.due_date = d.due_date || null;
      /* on an EDIT, recorded payments stay as they are — only fresh invoices start at the deposit */
      if (!editing) { payload.amount_paid = dep; if (total > 0 && dep >= total - 0.001) payload.paid_at = new Date().toISOString(); }
    }
    else { payload.valid_until = d.valid_until || null; if (d.request_id) payload.request_id = d.request_id; }
    btn.disabled = true; btn.textContent = editing ? 'Resending…' : 'Sending…';
    var r;
    if (editing) { if (state.docKind === 'quote') payload.status = 'sent'; r = await sb.from(c.table).update(payload).eq('id', d.editing_id).select().maybeSingle(); }
    else { r = await sb.from(c.table).insert(payload).select().maybeSingle(); }
    btn.disabled = false; btn.textContent = c.send;
    if (r.error) { showInvMsg(msg, r.error.message || 'Could not send.', 'err'); return; }
    if (state.docKind === 'quote' && d.request_id) { sb.from('quote_requests').update({ status: 'quoted' }).eq('id', d.request_id).then(function () {}).catch(function (e) { console.warn('mark request quoted failed', e); }); }
    if (state.docKind === 'invoice' && r.data && d.net_cost != null) { sb.from('invoice_finance').upsert({ invoice_id: r.data.id, net_cost: d.net_cost }).then(function () {}).catch(function (e) { console.warn('save invoice finance failed', e); }); }
    if (state.docKind === 'invoice' && d.source_quote_id) { sb.from('quotes').update({ status: 'accepted' }).eq('id', d.source_quote_id).then(function () {}).catch(function (e) { console.warn('mark quote accepted failed', e); }); }
    var num = (r.data && r.data[c.numKey]) ? r.data[c.numKey] : (d.editing_number || '');
    state.docFlash = { kind: 'ok', text: editing ? (c.flashWord + ' ' + num + ' updated & resent to ' + fullName(d.customer) + '.') : (c.flashWord + ' ' + num + ' sent to ' + fullName(d.customer) + '. It is now in their account.') };
    if (d.customer && d.customer.id) clearDraft(state.docKind, d.customer.id);
    state.docCustomer = null; state.docDraft = null; state.docView = 'form'; renderTab();
  }

  /* ---------- itineraries ---------- */
  var TRANSPORT_TYPES = ['Chauffeur', 'Private transfer', 'Car service', 'Car rental', 'Train', 'Yacht / boat', 'Helicopter', 'Other'];
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
  function hotelCard(x) {
    return h('div', { class: 'itin-card', 'data-itin': 'hotel' }, [itinRm(), cardImgKeep(x),
      h('div', { class: 'inv-row2' }, [poiField('Hotel', 'h-name', x && x.name, 'e.g. Burj Al Arab', function (p, inp) { fillFromPoi(p, inp, 'h-location', 'h-address'); }, 'h-location'), cityField('City', 'h-location', x && x.location, 'Start typing a city…')]),
      addrField('Address', 'h-address', x && x.address, 'Auto-fills, or click to pick a location', 'h-name', 'h-location'),
      h('div', { class: 'inv-row2' }, [cdt('Check-in', 'h-cin-date', 'h-cin-time', x && x.checkin_date, x && x.checkin_time), cdt('Check-out', 'h-cout-date', 'h-cout-time', x && x.checkout_date, x && x.checkout_time)]),
      h('div', { class: 'inv-row2' }, [clabel('Room / suite', 'h-room', x && x.room, 'e.g. Royal Suite'), clabel('Confirmation no.', 'h-conf', x && x.confirmation, 'Optional')]),
      clabel('Notes', 'h-notes', x && x.notes, 'Optional')
    ]);
  }
  function transportCard(x) {
    return h('div', { class: 'itin-card', 'data-itin': 'transport' }, [itinRm(), cardImgKeep(x),
      h('div', { class: 'inv-row2' }, [h('label', { class: 'inv-field' }, [h('span', { text: 'Type' }), styledSelect(null, (x && x.type) || 'Chauffeur', TRANSPORT_TYPES, null)]), cdt('Date & time', 't-date', 't-time', x && x.date, x && x.time)]),
      h('div', { class: 'inv-row2' }, [poiField('From / pickup', 't-from', x && x.from, 'e.g. DXB Airport', null), poiField('To / dropoff', 't-to', x && x.to, 'e.g. Burj Al Arab', null)]),
      h('p', { class: 'itin-opthint', text: 'Driver details — optional. Anything left blank is hidden from the customer.' }),
      h('div', { class: 'inv-row3' }, [clabel('Driver name', 't-driver', x && x.driver, 'Optional'), clabel('Car', 't-car', x && x.car, 'e.g. Mercedes S-Class'), clabel('License plate', 't-plate', x && x.plate, 'Optional')]),
      clabel('Notes', 't-notes', x && x.notes, 'Optional')
    ]);
  }
  function diningCard(x) {
    return h('div', { class: 'itin-card', 'data-itin': 'dining' }, [itinRm(), cardImgKeep(x),
      h('div', { class: 'inv-row2' }, [poiField('Name', 'e-name', x && x.name, 'e.g. Nobu Dubai', function (p, inp) { fillFromPoi(p, inp, 'e-location', 'e-address'); }, 'e-location'), h('label', { class: 'inv-field' }, [h('span', { text: 'Type' }), styledSelect(null, (x && x.category) || 'Restaurant', DINING_CATEGORIES, null)])]),
      h('div', { class: 'inv-row2' }, [cityField('City', 'e-location', x && x.location, 'Start typing a city…'), cdt('Date & time', 'e-date', 'e-time', x && x.date, x && x.time)]),
      addrField('Address', 'e-address', x && x.address, 'Auto-fills, or click to pick a location', 'e-name', 'e-location'),
      clabel('Notes', 'e-notes', x && x.notes, 'Optional')
    ]);
  }
  function entCard(x) {
    return h('div', { class: 'itin-card', 'data-itin': 'ent' }, [itinRm(), cardImgKeep(x),
      h('div', { class: 'inv-row2' }, [poiField('Name', 'e-name', x && x.name, 'e.g. Desert safari', function (p, inp) { fillFromPoi(p, inp, 'e-location', 'e-address'); }, 'e-location'), h('label', { class: 'inv-field' }, [h('span', { text: 'Category' }), styledSelect(null, (x && x.category) || 'Experience', ENT_CATEGORIES, null)])]),
      h('div', { class: 'inv-row2' }, [cityField('City', 'e-location', x && x.location, 'Start typing a city…'), cdt('Date & time', 'e-date', 'e-time', x && x.date, x && x.time)]),
      addrField('Address', 'e-address', x && x.address, 'Auto-fills, or click to pick a location', 'e-name', 'e-location'),
      clabel('Notes', 'e-notes', x && x.notes, 'Optional')
    ]);
  }
  function readCards(containerId, type) {
    var arr = [];
    Array.prototype.forEach.call(document.querySelectorAll('#' + containerId + ' .itin-card'), function (c) {
      var img = ((c.querySelector('.card-img-url') || {}).value || '').trim() || null;
      if (type === 'hotel') { var n = vcard(c, '.h-name'); if (!n) return; arr.push({ name: n, location: vcard(c, '.h-location'), address: vcard(c, '.h-address'), checkin_date: vcard(c, '.h-cin-date') || null, checkin_time: vcard(c, '.h-cin-time') || null, checkout_date: vcard(c, '.h-cout-date') || null, checkout_time: vcard(c, '.h-cout-time') || null, room: vcard(c, '.h-room'), confirmation: vcard(c, '.h-conf'), notes: vcard(c, '.h-notes'), image_url: img }); }
      else if (type === 'transport') { var hasAny = vcard(c, '.t-from') || vcard(c, '.t-to') || vcard(c, '.t-date'); if (!hasAny) return; var tt = (c.querySelector('.ss input[type=hidden]') || {}).value || ''; arr.push({ type: tt, date: vcard(c, '.t-date') || null, time: vcard(c, '.t-time') || null, from: vcard(c, '.t-from'), to: vcard(c, '.t-to'), driver: vcard(c, '.t-driver'), car: vcard(c, '.t-car'), plate: vcard(c, '.t-plate'), notes: vcard(c, '.t-notes'), image_url: img }); }
      else { var en = vcard(c, '.e-name'); if (!en) return; var cat = (c.querySelector('.ss input[type=hidden]') || {}).value || ''; arr.push({ name: en, category: cat, kind: type === 'dining' ? 'dining' : 'experience', date: vcard(c, '.e-date') || null, time: vcard(c, '.e-time') || null, location: vcard(c, '.e-location'), address: vcard(c, '.e-address'), notes: vcard(c, '.e-notes'), image_url: img }); }
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
      lb.appendChild(h('button', { class: 'btn btn-ghost', style: 'width:auto; margin-bottom:18px', onclick: function () { state.itinView = 'form'; renderTab(); }, text: '← New itinerary' }));
      lb.appendChild(h('div', { id: 'sentitin-list' }, [h('div', { class: 'dash-loading', text: 'Loading itineraries…' })]));
      wrap.appendChild(lb); setTimeout(loadSentItins, 0); return wrap;
    }
    restoreDraftForCustomer();
    var editing = !!(state.itinDraft && state.itinDraft.editing_id);
    wrap.appendChild(mainHead(editing ? 'Edit itinerary' : 'New itinerary', editing ? 'Update the trip — it replaces the version in their account.' : 'Build the trip — flights, hotels, transport and experiences. It appears in their account.'));
    var body = h('div', { class: 'main-body' });
    if (state.itinFlash) { body.appendChild(flashEl(state.itinFlash, true)); state.itinFlash = null; }
    body.appendChild(sentItinsBar());
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
    var box = document.getElementById('sentitin-list'); if (!box) return;
    var r = await sb.from('itineraries').select('*').order('created_at', { ascending: false }).limit(200);
    box = document.getElementById('sentitin-list'); if (!box) return;
    var rows = r.data || []; box.textContent = '';
    if (!rows.length) { box.appendChild(h('div', { class: 'pkg-empty', text: 'No itineraries sent yet.' })); return; }
    box.appendChild(h('div', { class: 'sq-wrap' }, rows.map(itinListRow)));
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
        h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto; padding:8px 14px', onclick: function () { editItinerary(row); }, text: 'Edit & resend' })
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
    state.itinDraft = { editing_id: row.id, editing_number: row.itinerary_number, title: row.title || '', destination: row.destination || '', trip_type: row.trip_type || null, start_date: row.start_date || null, end_date: row.end_date || null, pax_adults: row.pax_adults != null ? row.pax_adults : 1, pax_children: row.pax_children || 0, pax_infants: row.pax_infants || 0, segments: row.segments || [], hotels: row.hotels || [], transport: row.transport || [], entertainment: row.entertainment || [], notes: row.notes || '', total_charged: row.total_charged || null, comparable_total: row.comparable_total || null, currency: row.currency || 'USD', price_invoice_number: row.price_invoice_number || null, city_images: row.city_images || null };
    state.itinFlash = { kind: 'note', text: 'Editing ' + (row.itinerary_number || 'this itinerary') + '. Make your changes (photos too), then review & resend — it updates the version in their account.' };
    state.itinView = 'form'; state.tab = 'itineraries'; refreshNav(); renderTab();
  }
  function itinSection(title, containerId, cards, addLabel, addFn) {
    return h('div', { class: 'inv-section' }, [h('h3', { class: 'inv-h3', text: title }), h('div', { id: containerId, class: 'itin-cards' }, cards), h('button', { type: 'button', class: 'inv-addline', onclick: addFn, text: addLabel })]);
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
        h('div', { class: 'inv-row2' }, [invField('Trip title', 'itin-title', 'text', 'e.g. Dubai First Class Getaway', d.title), cityField('Destination', '', d.destination, 'Start typing a city…', 'itin-dest')]),
        h('div', { class: 'inv-row2' }, [invField('Trip starts', 'itin-start', 'date', '', d.start_date), invField('Trip ends', 'itin-end', 'date', '', d.end_date)]),
        h('p', { class: 'inv-sublabel', style: 'margin-top:16px', text: 'Travellers' }),
        h('div', { class: 'inv-row3' }, [paxField('Adults (12+)', 'itin-adults', d.pax_adults != null ? d.pax_adults : 1), paxField('Children (2–11)', 'itin-children', d.pax_children != null ? d.pax_children : 0), paxField('Infants (under 2)', 'itin-infants', d.pax_infants != null ? d.pax_infants : 0)])
      ]),
      h('div', { class: 'inv-section' }, [
        h('h3', { class: 'inv-h3', text: 'Flights' }),
        flightsSection(segs, detectTripType(d))
      ]),
      itinSection('Hotels', 'itin-hotels', (d.hotels || []).map(hotelCard), '+ Add hotel', function () { var c = hotelCard(); document.getElementById('itin-hotels').appendChild(c); initDatePickers(c); }),
      itinSection('Transportation', 'itin-transport', (d.transport || []).map(transportCard), '+ Add transport', function () { var c = transportCard(); document.getElementById('itin-transport').appendChild(c); initDatePickers(c); }),
      itinSection('Dining', 'itin-dining', (d.entertainment || []).filter(function (x) { return x.kind === 'dining'; }).map(diningCard), '+ Add dining', function () { var c = diningCard(); document.getElementById('itin-dining').appendChild(c); initDatePickers(c); }),
      itinSection('Entertainment', 'itin-ent', (d.entertainment || []).filter(function (x) { return x.kind !== 'dining'; }).map(entCard), '+ Add experience', function () { var c = entCard(); document.getElementById('itin-ent').appendChild(c); initDatePickers(c); }),
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
      h('div', { class: 'inv-submit' }, [h('span', { id: 'draft-ind', class: 'draft-ind', text: 'Auto-saved for this customer' }), h('div', { id: 'inv-msg', class: 'msg', style: 'display:none' }), h('button', { type: 'submit', class: 'btn btn-primary', style: 'width:auto; padding:13px 30px', text: 'Create & review' })])
    ]);
    setTimeout(function () { if (state.docCustomer) renderResolved(state.docCustomer); loadTemplates(); applyTripType(detectTripType(d)); initDatePickers(form); }, 0);
    return form;
  }
  function collectItin() {
    var pa = parseInt(val('itin-adults'), 10); if (isNaN(pa)) pa = 0;
    var pc = parseInt(val('itin-children'), 10) || 0, pi = parseInt(val('itin-infants'), 10) || 0;
    return { customer: state.docCustomer, title: val('itin-title'), destination: val('itin-dest'), start_date: val('itin-start') || null, end_date: val('itin-end') || null, pax_adults: pa, pax_children: pc, pax_infants: pi, passengers: (pa + pc + pi) || 1, trip_type: readTripType(), segments: readSegments(), hotels: readCards('itin-hotels', 'hotel'), transport: readCards('itin-transport', 'transport'), entertainment: readCards('itin-dining', 'dining').concat(readCards('itin-ent', 'ent')), notes: val('itin-notes'), total_charged: parseFloat(val('itin-total')) || null, comparable_total: parseFloat(val('itin-comp')) || null, currency: val('itin-cur') || (state.settings && state.settings.default_currency) || 'USD', price_invoice_number: val('itin-pull-inv') || null };
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
    if (!d.segments.length && !d.hotels.length && !d.transport.length && !d.entertainment.length) { showInvMsg(msg, 'Add at least one flight, hotel, transfer or experience.', 'err'); return; }
    if (roundTripGap(d)) { showInvMsg(msg, RT_GAP_MSG, 'err'); return; }
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
      start_date: d.start_date || null, end_date: d.end_date || null, pax_adults: d.pax_adults, pax_children: d.pax_children, pax_infants: d.pax_infants, passengers: d.passengers,
      segments: d.segments || [], hotels: d.hotels || [], transport: d.transport || [], entertainment: d.entertainment || [],
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
    var payload = { customer_email: d.customer.email, account_number: d.customer.account_number || null, user_id: d.customer.id, title: d.title || null, destination: d.destination || null, trip_type: d.trip_type || null, start_date: d.start_date, end_date: d.end_date, passengers: d.passengers, pax_adults: d.pax_adults, pax_children: d.pax_children, pax_infants: d.pax_infants, segments: d.segments, hotels: d.hotels, transport: d.transport, entertainment: d.entertainment, notes: d.notes || null, total_charged: d.total_charged, comparable_total: d.comparable_total, price_invoice_number: d.price_invoice_number || null, city_images: (d.city_images && Object.keys(d.city_images).length) ? d.city_images : null };
    var editing = !!d.editing_id;
    btn.disabled = true; btn.textContent = editing ? 'Updating…' : 'Sending…';
    var r;
    if (editing) r = await sb.from('itineraries').update(payload).eq('id', d.editing_id).select().maybeSingle();
    else r = await sb.from('itineraries').insert(payload).select().maybeSingle();
    btn.disabled = false; btn.textContent = 'Send to customer';
    if (r.error) { showInvMsg(msg, r.error.message || 'Could not send.', 'err'); return; }
    if (d.customer && d.customer.id) clearDraft('itinerary', d.customer.id);
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
    return { view: 'list', editing_id: null, target_kind: 'account', customer: null, group: null, groups: null, name: '', title: '', destination: '', start_date: null, end_date: null, currency: (state.settings && state.settings.default_currency) || 'USD', total_charged: null, comparable_total: null, price_invoice_number: null, notes: '', shared: { segments: [], trip_type: null, hotels: [], transport: [], entertainment: [] }, city_images: null, pods: [], podDraft: null, podIndex: null };
  }
  function tabGroupTrips() {
    if (!state.gt) state.gt = gtBlank();
    var v = state.gt.view;
    if (v === 'setup') return gtSetupView();
    if (v === 'pods') return gtPodsView();
    if (v === 'podedit') return gtPodEditView();
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
  function gtCollectSetup() {
    var g = state.gt; if (!g) return;
    g.name = val('gt-name'); g.title = val('gt-title'); g.destination = val('gt-dest');
    g.start_date = val('gt-start') || null; g.end_date = val('gt-end') || null;
    g.total_charged = parseFloat(val('itin-total')) || null; g.comparable_total = parseFloat(val('itin-comp')) || null;
    g.currency = val('itin-cur') || g.currency || 'USD'; g.price_invoice_number = val('itin-pull-inv') || null;
    g.notes = val('gt-notes');
    if (document.getElementById('inv-segs')) {
      g.shared = { segments: readSegments(), trip_type: readTripType(), hotels: readCards('itin-hotels', 'hotel'), transport: readCards('itin-transport', 'transport'), entertainment: readCards('itin-dining', 'dining').concat(readCards('itin-ent', 'ent')) };
    }
  }
  function gtSetupView() {
    state.gtBuilding = true;
    var g = state.gt, wrap = h('div');
    wrap.appendChild(mainHead(g.editing_id ? 'Edit group trip' : 'New group trip', 'Build the shared journey once. Next, add each city group and we generate an itinerary for each.'));
    var body = h('div', { class: 'main-body' });
    if (state.gtFlash) { body.appendChild(flashEl(state.gtFlash, false)); state.gtFlash = null; }
    body.appendChild(gtItinBanner());
    var segs = (g.shared.segments && g.shared.segments.length) ? g.shared.segments : [null];
    var form = h('form', { class: 'inv-form', onsubmit: function (e) { e.preventDefault(); gtContinueToPods(); } }, [
      h('div', { class: 'inv-section' }, [
        h('h3', { class: 'inv-h3', text: 'Who is this trip for?' }),
        gtSeg(g.target_kind, [['account', 'One shared login'], ['group', 'Linked group (separate logins)']], function (k) { gtCollectSetup(); g.target_kind = k; renderTab(); }),
        g.target_kind === 'account'
          ? h('div', { style: 'margin-top:14px' }, [h('p', { class: 'inv-sublabel', style: 'margin-bottom:8px', text: 'The one account the whole family signs into. Every city group’s itinerary goes here.' }), h('div', { id: 'gt-cust-box' }, g.customer ? [gtCustChip(g.customer)] : [miniCustomerSearch('Search the family account…', function (c) { g.customer = c; var b = document.getElementById('gt-cust-box'); if (b) { b.textContent = ''; b.appendChild(gtCustChip(c)); } })])])
          : h('div', { style: 'margin-top:14px' }, [h('p', { class: 'inv-sublabel', style: 'margin-bottom:8px', text: 'Each traveller keeps their own login; the group links them so everyone sees every itinerary.' }), gtGroupControl()])
      ]),
      h('div', { class: 'inv-section' }, [
        h('h3', { class: 'inv-h3', text: 'Trip' }),
        h('div', { class: 'inv-row2', style: 'margin-bottom:16px' }, [invField('Trip name (for your list)', 'gt-name', 'text', 'e.g. Loya Family, Turkiye', g.name), invField('Display title (shown to customer)', 'gt-title', 'text', 'e.g. Turkiye Together', g.title)]),
        cityField('Destination', '', g.destination, 'Start typing a city…', 'gt-dest'),
        h('div', { class: 'inv-row2' }, [invField('Trip starts', 'gt-start', 'date', '', g.start_date), invField('Trip ends', 'gt-end', 'date', '', g.end_date)])
      ]),
      h('div', { class: 'inv-section' }, [
        h('h3', { class: 'inv-h3', text: 'Shared journey: what everyone does together' }),
        h('p', { class: 'inv-sublabel', style: 'margin:-2px 0 14px', text: 'The flights everyone takes together, in order, from where they meet (like the layover city) to the end of the shared trip. Add hotels and the rest below. Each city group adds its own flights home in the next step.' }),
        templateBar(),
        flightsSection(segs, null, { plain: true })
      ]),
      itinSection('Hotels', 'itin-hotels', (g.shared.hotels || []).map(hotelCard), '+ Add hotel', function () { var c = hotelCard(); document.getElementById('itin-hotels').appendChild(c); initDatePickers(c); }),
      itinSection('Transportation', 'itin-transport', (g.shared.transport || []).map(transportCard), '+ Add transport', function () { var c = transportCard(); document.getElementById('itin-transport').appendChild(c); initDatePickers(c); }),
      itinSection('Dining', 'itin-dining', (g.shared.entertainment || []).filter(function (x) { return x.kind === 'dining'; }).map(diningCard), '+ Add dining', function () { var c = diningCard(); document.getElementById('itin-dining').appendChild(c); initDatePickers(c); }),
      itinSection('Entertainment', 'itin-ent', (g.shared.entertainment || []).filter(function (x) { return x.kind !== 'dining'; }).map(entCard), '+ Add experience', function () { var c = entCard(); document.getElementById('itin-ent').appendChild(c); initDatePickers(c); }),
      h('div', { class: 'inv-section' }, [
        h('h3', { class: 'inv-h3', text: 'Pricing & savings (optional)' }),
        h('p', { class: 'inv-sublabel', style: 'margin:-2px 0 14px', text: 'Applied to each generated itinerary. Pull from an invoice or type it in.' }),
        h('div', { class: 'inv-row2' }, [
          h('label', { class: 'inv-field' }, [h('span', { text: 'Pull from invoice no.' }), h('div', { class: 'itin-pull-row' }, [h('input', { id: 'itin-pull-inv', class: 'inv-input', type: 'text', placeholder: 'e.g. INV-100245', autocomplete: 'off', value: g.price_invoice_number || '' }), h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto; padding:0 16px; height:46px', onclick: pullInvoicePricing, text: 'Pull' })])]),
          h('div', { class: 'inv-field' }, [h('span', { class: 'seg-lookup-spacer', text: 'x' }), h('span', { id: 'itin-pull-status', class: 'seg-lookup-status', style: 'margin-top:13px' })])
        ]),
        h('div', { class: 'inv-row2' }, [invField('Your price (total, per itinerary)', 'itin-total', 'number', '0.00', g.total_charged), invField('Comparable / retail price', 'itin-comp', 'number', '0.00', g.comparable_total)]),
        h('input', { type: 'hidden', id: 'itin-cur', value: g.currency || 'USD' })
      ]),
      h('div', { class: 'inv-section' }, [h('h3', { class: 'inv-h3', text: 'Notes (optional)' }), h('textarea', { id: 'gt-notes', class: 'inv-input inv-textarea', rows: '2', placeholder: 'Shown on every itinerary in this group.', value: g.notes || '' })]),
      h('div', { class: 'inv-submit' }, [
        h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto; padding:13px 24px', onclick: function () { state.gt = gtBlank(); renderTab(); }, text: 'Cancel' }),
        h('div', { id: 'gt-msg', class: 'msg', style: 'display:none' }),
        h('button', { type: 'submit', class: 'btn btn-primary', style: 'width:auto; padding:13px 30px', text: 'Continue to city groups →' })
      ])
    ]);
    body.appendChild(form); wrap.appendChild(body);
    setTimeout(function () { relabelSegs(); loadTemplates(); initDatePickers(form); }, 0);
    return wrap;
  }
  function gtItinBanner() {
    return h('div', { class: 'gt-banner' }, [
      h('span', { class: 'gt-banner-tag', text: 'Itinerary' }),
      h('span', { class: 'gt-banner-text', text: 'Each city group becomes its own full itinerary (flights, hotels, everything) in the family’s account.' })
    ]);
  }
  function gtContinueToPods() {
    gtCollectSetup(); var g = state.gt, msg = document.getElementById('gt-msg');
    if (g.target_kind === 'account' && !g.customer) { showInvMsg(msg, 'Pick the shared account first.', 'err'); return; }
    if (g.target_kind === 'group' && (!g.group || !g.group.id)) { showInvMsg(msg, 'Pick or create a linked group first.', 'err'); return; }
    var s = g.shared;
    if (!(s.segments && s.segments.length) && !(s.hotels && s.hotels.length) && !(s.transport && s.transport.length) && !(s.entertainment && s.entertainment.length)) { showInvMsg(msg, 'Add at least one shared flight, hotel, transfer or experience.', 'err'); return; }
    g.view = 'pods'; renderTab();
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
  function gtPodPax(travelers) { var n = (travelers || '').split(/[\n,]+/).map(function (x) { return x.trim(); }).filter(Boolean).length; return n || 1; }
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
  function gtPodCard(pod, i) {
    var pax = gtPodPax(pod.travelers);
    var outR = gtSharedRoute(podOut(pod)), retR = gtSharedRoute(podRet(pod));
    var routes = [outR ? 'Out  ' + outR : '', retR ? 'Home  ' + retR : ''].filter(Boolean).join('      ·      ') || 'No flights yet';
    return h('div', { class: 'pkg-card' }, [
      h('div', { class: 'pkg-card-main' }, [
        h('div', { class: 'pkg-card-name', text: pod.label || ('City group ' + (i + 1)) }),
        h('div', { class: 'pkg-card-sub', text: routes }),
        pod.travelers ? h('div', { class: 'gt-pod-travelers', text: pax + ' traveller' + (pax > 1 ? 's' : '') + ': ' + pod.travelers.split(/[\n,]+/).map(function (x) { return x.trim(); }).filter(Boolean).join(', ') }) : null
      ]),
      h('div', { class: 'pkg-card-actions' }, [
        h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto', onclick: function () { gtEditPod(i); }, text: 'Edit' }),
        h('button', { type: 'button', class: 'btn btn-ghost pkg-del-btn', style: 'width:auto', onclick: function () { state.gt.pods.splice(i, 1); renderTab(); }, text: 'Remove' })
      ])
    ]);
  }
  function gtEditPod(i) { var g = state.gt; g.podDraft = JSON.parse(JSON.stringify(g.pods[i])); g.podIndex = i; g.view = 'podedit'; renderTab(); }
  function gtPodsView() {
    var g = state.gt, wrap = h('div');
    wrap.appendChild(mainHead('City groups', 'Add each departure/return city. We generate one itinerary per group — shared journey in the middle, their own flights on the ends.'));
    var body = h('div', { class: 'main-body' });
    if (state.gtFlash) { body.appendChild(flashEl(state.gtFlash, false)); state.gtFlash = null; }
    body.appendChild(gtItinBanner());
    body.appendChild(h('div', { class: 'gt-summary' }, [
      h('div', { class: 'gt-summary-main' }, [
        h('div', { class: 'gt-summary-title', text: (g.title || g.name || 'Group trip') + (g.destination ? ' · ' + g.destination : '') }),
        h('div', { class: 'gt-summary-sub', text: [(g.target_kind === 'account' ? ('Shared account: ' + (g.customer ? fullName(g.customer) : '—')) : ('Linked group: ' + (g.group ? g.group.name : '—'))), 'Shared: ' + (gtSharedRoute(g.shared.segments) || 'no flights') + gtSharedExtras(g.shared)].join('  ·  ') })
      ]),
      h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto', onclick: function () { g.view = 'setup'; renderTab(); }, text: '← Edit shared trip' })
    ]));
    var list = h('div', { class: 'gt-pods' });
    if (!g.pods.length) list.appendChild(h('div', { class: 'pkg-empty', text: 'No city groups yet. Add the first one below.' }));
    g.pods.forEach(function (pod, i) { list.appendChild(gtPodCard(pod, i)); });
    body.appendChild(list);
    body.appendChild(h('button', { class: 'btn btn-ghost', style: 'width:auto; margin-top:6px', onclick: function () { g.podDraft = { label: '', title: '', travelers: '', out_segments: [], ret_segments: [] }; g.podIndex = null; g.view = 'podedit'; renderTab(); }, text: '+ Add city group' }));
    body.appendChild(h('div', { class: 'gt-generate' }, [
      h('div', { id: 'gt-msg', class: 'msg', style: 'display:none' }),
      h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto', onclick: function (e) { gtSaveOnly(e.target); }, text: 'Save without generating' }),
      h('button', { type: 'button', id: 'gt-generate-btn', class: 'btn btn-primary', style: 'width:auto; padding:13px 30px', onclick: gtGenerate, text: 'Generate ' + (g.pods.length || '') + ' itinerar' + (g.pods.length === 1 ? 'y' : 'ies') })
    ]));
    wrap.appendChild(body); return wrap;
  }
  function gtPodEditView() {
    state.gtBuilding = true;
    var g = state.gt, pod = g.podDraft || { label: '', title: '', travelers: '', out_segments: [], ret_segments: [] }, wrap = h('div');
    wrap.appendChild(mainHead(g.podIndex == null ? 'New city group' : 'Edit city group', 'This group has its own departure and return city. The shared journey is inserted in the middle automatically.'));
    var body = h('div', { class: 'main-body' });
    var sharedR = gtSharedRoute(g.shared.segments), meet = sharedR ? sharedR.split(' → ')[0] : 'the meeting point';
    var form = h('form', { class: 'inv-form', onsubmit: function (e) { e.preventDefault(); gtSavePod(); } }, [
      h('div', { class: 'inv-section' }, [
        h('h3', { class: 'inv-h3', text: 'City group' }),
        h('div', { class: 'inv-row2', style: 'margin-bottom:16px' }, [invField('Label (for your list)', 'gt-pod-label', 'text', 'e.g. Houston travelers', pod.label), invField('Itinerary title (optional)', 'gt-pod-title', 'text', 'Defaults to the trip title', pod.title)]),
        h('label', { class: 'inv-field' }, [h('span', { text: 'Travellers (one per line, or comma-separated)' }), h('textarea', { id: 'gt-pod-travelers', class: 'inv-input inv-textarea', rows: '3', placeholder: 'e.g.\nMr Ahmed Loya\nMrs Loya', value: pod.travelers || '' })])
      ]),
      h('div', { class: 'inv-section' }, [
        h('h3', { class: 'inv-h3', text: 'Departure — getting there' }),
        h('p', { class: 'inv-sublabel', style: 'margin:-2px 0 14px', text: 'Their flight(s) from their home city to ' + meet + ', where the group meets.' }),
        podLegs('out', podOut(pod))
      ]),
      h('div', { class: 'gt-mid-note' }, [h('span', { class: 'gt-mid-line' }), h('span', { class: 'gt-mid-text', text: sharedR ? 'Everyone shares  ·  ' + sharedR : 'The shared journey goes here' }), h('span', { class: 'gt-mid-line' })]),
      h('div', { class: 'inv-section' }, [
        h('h3', { class: 'inv-h3', text: 'Return — heading home' }),
        h('p', { class: 'inv-sublabel', style: 'margin:-2px 0 14px', text: 'Their flight(s) from ' + meet + ' back to their home city.' }),
        podLegs('ret', podRet(pod))
      ]),
      h('div', { class: 'inv-submit' }, [
        h('button', { type: 'button', class: 'btn btn-ghost', style: 'width:auto; padding:13px 24px', onclick: function () { g.view = 'pods'; g.podDraft = null; g.podIndex = null; renderTab(); }, text: 'Cancel' }),
        h('div', { id: 'gt-pod-msg', class: 'msg', style: 'display:none' }),
        h('button', { type: 'submit', class: 'btn btn-primary', style: 'width:auto; padding:13px 30px', text: 'Save city group' })
      ])
    ]);
    body.appendChild(form); wrap.appendChild(body);
    setTimeout(function () { initDatePickers(form); }, 0);
    return wrap;
  }
  function gtSavePod() {
    var g = state.gt, msg = document.getElementById('gt-pod-msg');
    var label = val('gt-pod-label'), title = val('gt-pod-title'), travelers = ((document.getElementById('gt-pod-travelers') || {}).value || '').trim();
    var outSegs = readLegsFrom(document.querySelector('.inv-segs[data-leg="out"]'));
    var retSegs = readLegsFrom(document.querySelector('.inv-segs[data-leg="ret"]'));
    if (!label) { showInvMsg(msg, 'Give this city group a label (e.g. “Houston travelers”).', 'err'); return; }
    if (!outSegs.length && !retSegs.length) { showInvMsg(msg, 'Add at least their departure flight (a From and To).', 'err'); return; }
    var pod = { label: label, title: title || null, travelers: travelers, out_segments: outSegs, ret_segments: retSegs };
    if (g.podIndex == null) g.pods.push(pod); else g.pods[g.podIndex] = pod;
    g.podDraft = null; g.podIndex = null; g.view = 'pods'; renderTab();
  }
  function gtOwner() {
    var g = state.gt;
    if (g.target_kind === 'account') { if (!g.customer) return null; return { customer_email: g.customer.email, account_number: g.customer.account_number || null, user_id: g.customer.id || null, group_id: null }; }
    if (!g.group || !g.group.id) return null;
    var mem = (g.group.travel_group_members || []);
    return { customer_email: (mem[0] && mem[0].customer_email) || '', account_number: null, user_id: (mem[0] && mem[0].customer_id) || null, group_id: g.group.id };
  }
  async function gtPersist(owner) {
    var g = state.gt;
    var payload = { name: g.name || g.title || 'Group trip', target_kind: g.target_kind, customer_email: owner.customer_email || null, account_number: owner.account_number, user_id: owner.user_id, group_id: owner.group_id, title: g.title || null, destination: g.destination || null, start_date: g.start_date || null, end_date: g.end_date || null, currency: g.currency || 'USD', total_charged: g.total_charged, comparable_total: g.comparable_total, notes: g.notes || null, shared: g.shared || {}, pods: g.pods || [], city_images: (g.city_images && Object.keys(g.city_images).length) ? g.city_images : null };
    var r;
    if (g.editing_id) r = await sb.from('group_trips').update(payload).eq('id', g.editing_id).select('id').maybeSingle();
    else r = await sb.from('group_trips').insert(payload).select('id').maybeSingle();
    if (r.error || !r.data) throw (r.error || new Error('persist failed'));
    g.editing_id = r.data.id;
    return r.data.id;
  }
  async function gtSaveOnly(btn) {
    var g = state.gt, owner = gtOwner();
    if (!owner) { var m = document.getElementById('gt-msg'); if (m) showInvMsg(m, g.target_kind === 'account' ? 'Pick the shared account first.' : 'Pick or create a linked group first.', 'err'); return; }
    btn.disabled = true; btn.textContent = 'Saving…';
    try { await gtPersist(owner); } catch (e) { btn.disabled = false; btn.textContent = 'Save without generating'; var m2 = document.getElementById('gt-msg'); if (m2) showInvMsg(m2, 'Could not save the group trip.', 'err'); return; }
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
    var g = state.gt, msg = document.getElementById('gt-msg');
    function err(m) { if (msg) showInvMsg(msg, m, 'err'); }
    var owner = gtOwner();
    if (!owner) { err(g.target_kind === 'account' ? 'Pick the shared account first.' : 'Pick or create a linked group first.'); return; }
    if (g.target_kind === 'group' && !((g.group.travel_group_members || []).length)) { err('Add at least one member to the linked group.'); return; }
    if (!g.pods.length) { err('Add at least one city group first.'); return; }
    var btn = document.getElementById('gt-generate-btn'); if (btn) { btn.disabled = true; btn.textContent = 'Generating…'; }
    var gtId; try { gtId = await gtPersist(owner); } catch (e) { gtId = null; }
    if (!gtId) { if (btn) { btn.disabled = false; btn.textContent = 'Generate itineraries'; } err('Could not save the group trip.'); return; }
    try { await sb.from('itineraries').delete().eq('group_trip_id', gtId); } catch (e) { }
    var rows = g.pods.map(function (pod) {
      var composed = podOut(pod).concat(g.shared.segments || [], podRet(pod));
      var dates = gtComposedDates(composed), pax = gtPodPax(pod.travelers);
      return {
        customer_email: owner.customer_email, account_number: owner.account_number, user_id: owner.user_id,
        group_id: owner.group_id, group_trip_id: gtId, traveler_names: pod.travelers || null,
        title: (pod.title || (g.title ? g.title + ' · ' + pod.label : pod.label)), destination: g.destination || null, trip_type: 'multi',
        start_date: g.start_date || dates.start, end_date: g.end_date || dates.end,
        passengers: pax, pax_adults: pax, pax_children: 0, pax_infants: 0,
        segments: composed, hotels: g.shared.hotels || [], transport: g.shared.transport || [], entertainment: g.shared.entertainment || [],
        notes: g.notes || null, total_charged: g.total_charged, comparable_total: g.comparable_total, currency: g.currency || 'USD',
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
    var sub = [row.destination, (pods.length + ' city group' + (pods.length !== 1 ? 's' : '')), (row.target_kind === 'group' ? 'Linked group' : 'Shared account'), row.created_at ? ('Created ' + fmtDate(row.created_at)) : ''].filter(Boolean).join('  ·  ');
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
